import os
import json
import time
import logging
from datetime import datetime
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

BASE_URL = "https://api.example.com"
HELP_USER_IDS = [
    "SignTask_85ca719638e44b30845dce5642b215de",
    "SignTask_6dfecf8f6e484ab0894c39fbeb23ff62",
    "SignTask_4f448acfd6174f8a800f3a7096d99fbd"
]

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.69(0x18004539) NetType/4G Language/zh_CN miniProgram/wx336dcaf6a1ecf632",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/memberft/student/studentcard/signIn",
    "TC-PLATFORM-CODE": "WX_MP",
    "TC-OS-TYPE": "1",
    "platform": "WX_MP",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "accountSystem": "1",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

LOTTERY_REFERER = os.environ.get("TC_LOTTERY_REFERER", "")
if not LOTTERY_REFERER:
    LOTTERY_REFERER = f"{BASE_URL}/memberft/student/studentcard/moneySave?shareId=share_lottery_ba77625be8e1Y2JU&swellShareId=&refid=2000654065&trackCode=general&randomUserId=CTGK6M2353ZYW4Z31776762751033"

def get_boxjs_data():
    """从BoxJS获取数据"""
    try:
        # BoxJS存储路径
        boxjs_path = "/storage/emulated/0/boxjs.json"
        if os.path.exists(boxjs_path):
            with open(boxjs_path, 'r', encoding='utf-8') as f:
                boxjs_data = json.load(f)
                return boxjs_data.get("tongcheng", {})
    except Exception as e:
        logger.warning(f"读取BoxJS数据失败: {e}")
    return {}

def save_to_boxjs(data):
    """保存数据到BoxJS"""
    try:
        boxjs_path = "/storage/emulated/0/boxjs.json"
        boxjs_data = {}
        if os.path.exists(boxjs_path):
            with open(boxjs_path, 'r', encoding='utf-8') as f:
                boxjs_data = json.load(f)
        
        if "tongcheng" not in boxjs_data:
            boxjs_data["tongcheng"] = {}
        
        boxjs_data["tongcheng"].update(data)
        
        with open(boxjs_path, 'w', encoding='utf-8') as f:
            json.dump(boxjs_data, f, ensure_ascii=False, indent=2)
        
        logger.info("数据已保存到BoxJS")
    except Exception as e:
        logger.error(f"保存到BoxJS失败: {e}")

def load_accounts_from_env() -> List[Dict[str, str]]:
    """从环境变量和BoxJS加载账号数据"""
    accounts = []
    
    # 首先尝试从BoxJS加载
    boxjs_data = get_boxjs_data()
    if boxjs_data:
        account_data = boxjs_data.get("account", {})
        if account_data.get("userToken") and account_data.get("openId") and account_data.get("userKey"):
            accounts.append({
                "remark": account_data.get("remark", "BoxJS账号"),
                "userToken": account_data["userToken"],
                "openId": account_data["openId"],
                "userKey": account_data["userKey"],
                "from_boxjs": True
            })
            logger.info("从BoxJS加载账号数据成功")
    
    # 然后从环境变量加载
    tc_value = os.environ.get("tc", "").strip()
    if tc_value:
        lines = tc_value.splitlines()
        for idx, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split("#")
            if len(parts) < 4:
                logger.warning(f"第 {idx} 行格式错误，至少需要4段（备注#usertoken#openId#userKey），跳过: {line}")
                continue

            remark = parts[0] or f"账号{len(accounts)+1}"
            user_token = parts[1]
            open_id = parts[2]
            user_key = parts[3]

            account_info = {
                "remark": remark,
                "userToken": user_token,
                "openId": open_id,
                "userKey": user_key,
                "from_env": True
            }
            accounts.append(account_info)
            
            # 将环境变量中的数据保存到BoxJS
            save_to_boxjs({
                "account": {
                    "remark": remark,
                    "userToken": user_token,
                    "openId": open_id,
                    "userKey": user_key,
                    "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            })
    
    if not accounts:
        logger.error("未找到有效的账号数据!请设置环境变量tc或确保BoxJS中有数据")
        logger.error("环境变量格式：备注#usertoken#openId#userKey")
        return []

    logger.info(f"同程旅行小程序打卡领现金")
    logger.info(f"共加载 {len(accounts)} 个账号")
    return accounts

class TongChengTask:
    def __init__(self, account: Dict[str, str]):
        self.remark = account.get("remark", "未知")
        self.user_token = account.get("userToken", "")
        self.open_id = account.get("openId", "")
        self.user_key = account.get("userKey", "")
        self.session = requests.Session()
        self._update_headers()
        self.today = datetime.now().strftime("%Y-%m-%d")
        self.act_ids = []
        
        # 保存当前账号信息到BoxJS
        self._save_current_account()

    def _save_current_account(self):
        """保存当前账号信息到BoxJS"""
        account_data = {
            "current_account": {
                "remark": self.remark,
                "userToken": self.user_token,
                "openId": self.open_id,
                "userKey": self.user_key,
                "last_used": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        save_to_boxjs(account_data)

    def _update_headers(self):
        headers = DEFAULT_HEADERS.copy()
        headers.update({
            "userToken": self.user_token,
            "TC-USER-TOKEN": self.user_token,
            "userTokenMode": "1",
            "openId": self.open_id,
            "userKey": self.user_key,
        })
        self.session.headers.update(headers)

    def _post(self, url: str, data: dict, extra_headers: dict = None) -> dict:
        full_url = url if url.startswith("http") else BASE_URL + url
        headers = self.session.headers.copy()
        if extra_headers:
            headers.update(extra_headers)
        try:
            resp = self.session.post(full_url, json=data, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"[{self.remark}] 请求失败: {url} - {e}")
            return {"code": -1, "msg": str(e)}
        except json.JSONDecodeError:
            logger.error(f"[{self.remark}] 响应非 JSON: {resp.text[:200]}")
            return {"code": -1, "msg": "Invalid JSON response"}

    def step1_get_act_info(self) -> bool:
        logger.info(f"[{self.remark}] 步骤1：获取活动信息...")
        url = "/platformflowpool/signTask/getActInfo"
        resp = self._post(url, {})
        if resp.get("code") != 0:
            logger.error(f"[{self.remark}] 获取活动信息失败: {resp}")
            return False

        data = resp.get("data", {})
        act_ids = []
        if "cashAwardAct" in data and data["cashAwardAct"]:
            act_ids.append(data["cashAwardAct"].get("actId"))
        if "challengeAwardAct" in data and data["challengeAwardAct"]:
            act_ids.append(data["challengeAwardAct"].get("actId"))
        self.act_ids = [aid for aid in act_ids if aid]
        logger.info(f"[{self.remark}] 发现 {len(self.act_ids)} 个签到活动")
        return len(self.act_ids) > 0

    def step2_sign_all(self) -> int:
        if not self.act_ids:
            logger.error(f"[{self.remark}] 没有可用的签到活动")
            return 0

        logger.info(f"[{self.remark}] 步骤2：开始签到（共{len(self.act_ids)}个活动）...")
        success_count = 0
        url = "/platformflowpool/signTask/startTask"

        for act_id in self.act_ids:
            resp = self._post(url, {"actId": act_id})
            code = resp.get("code")
            if code == 0:
                logger.info(f"[{self.remark}] 活动 签到成功！")
                success_count += 1
            elif code == 90003:
                pass
            else:
                logger.error(f"[{self.remark}] 活动 {act_id} 签到失败: {resp.get('msg')}")

        logger.info(f"[{self.remark}] 签到完成，成功 {success_count}/{len(self.act_ids)} 个活动")
        return success_count

    def step3_help(self) -> int:
        success_count = 0
        for user_id in HELP_USER_IDS:
            check_url = "/platformflowpool/signTask/helpCheck"
            check_data = {"calendar": self.today, "userId": user_id}
            resp = self._post(check_url, check_data)
            if resp.get("code") != 0:
                continue

            help_state = resp.get("data", {}).get("helpState")
            if help_state != 0:
                continue

            help_url = "/platformflowpool/signTask/actionHelp"
            help_resp = self._post(help_url, check_data)
            code = help_resp.get("code")
            help_state_after = help_resp.get("data", {}).get("helpState")

            if code == 0 and help_state_after == 9:
                success_count += 1

        return success_count

    def step4_lottery(self) -> Dict[str, int]:
        logger.info(f"[{self.remark}] 步骤3：开始抽奖（三次）...")
        lottery_url = "/qiushiinnerapi/fission/lottery/lottery"
        rec_url = "/qiushiinnerapi/fission/lottery/rec"

        extra_headers = {
            "secToken": self.user_token,
            "platform": "WX_H5",
            "anonymity": "0",
            "osType": "1",
            "versionType": "1",
            "Referer": LOTTERY_REFERER,
        }

        success_count = 0
        fail_count = 0

        for block_index in (3, 2, 1):
            logger.info(f"[{self.remark}] 第 {4-block_index} 次抽奖...")
            lottery_data = {"schGuid": "fission-sch-2025-dxneldyh", "blockIndex": block_index}
            resp = self._post(lottery_url, lottery_data, extra_headers=extra_headers)

            if resp.get("code") != 0 or not resp.get("isSucceed"):
                msg = resp.get('message') or resp.get('msg')
                logger.warning(f"[{self.remark}] 抽奖失败: {msg}")
                fail_count += 1
                continue

            prize_data = resp.get("data", {})
            share_guid = prize_data.get("currentShareId")
            prize_title = prize_data.get("resTitle", "未知奖励")
            logger.info(f"[{self.remark}] 抽奖成功，获得: {prize_title}")

            if share_guid:
                rec_data = {"shareGuid": share_guid}
                rec_resp = self._post(rec_url, rec_data, extra_headers=extra_headers)
                if rec_resp.get("code") == 0 and rec_resp.get("isSucceed"):
                    logger.info(f"[{self.remark}] 奖励领取成功")
                    success_count += 1
                else:
                    logger.warning(f"[{self.remark}] 奖励领取失败: {rec_resp.get('message') or rec_resp.get('msg')}")
                    fail_count += 1
            else:
                logger.warning(f"[{self.remark}] 未获取到 shareGuid，无法领取")
                fail_count += 1

            time.sleep(1)

        return {"success": success_count, "fail": fail_count}

    def run(self) -> dict:
        logger.info(f"========== 开始执行账号 [{self.remark}] ==========")
        result = {
            "remark": self.remark,
            "openId": self.open_id,
            "sign_success": 0,
            "help_success_count": 0,
            "lottery_success": 0,
            "lottery_fail": 0,
            "error": None
        }

        try:
            if not self.step1_get_act_info():
                result["error"] = "获取活动信息失败"
                return result

            result["sign_success"] = self.step2_sign_all()
            result["help_success_count"] = self.step3_help()

            lottery_stats = self.step4_lottery()
            result["lottery_success"] = lottery_stats["success"]
            result["lottery_fail"] = lottery_stats["fail"]

            # 保存执行结果到BoxJS
            self._save_execution_result(result)

        except Exception as e:
            logger.exception(f"[{self.remark}] 账号执行异常: {e}")
            result["error"] = str(e)

        logger.info(f"[{self.remark}] 执行完成: 签到成功={result['sign_success']}, 抽奖成功={result['lottery_success']}")
        return result

    def _save_execution_result(self, result: dict):
        """保存执行结果到BoxJS"""
        execution_data = {
            "last_execution": {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "result": result
            }
        }
        save_to_boxjs(execution_data)

def run_all_accounts(accounts: List[Dict], max_workers: int = 1) -> List[dict]:
    results = []
    if max_workers <= 1:
        for acc in accounts:
            task = TongChengTask(acc)
            results.append(task.run())
            time.sleep(2)
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(TongChengTask(acc).run): acc for acc in accounts}
            for future in as_completed(futures):
                try:
                    res = future.result()
                    results.append(res)
                except Exception as e:
                    logger.error(f"线程执行异常: {e}")
                    results.append({"error": str(e)})
    return results

def print_summary(results: List[dict]):
    total = len(results)
    sign_success_total = sum(r.get("sign_success", 0) for r in results)
    help_total_success = sum(r.get("help_success_count", 0) for r in results)
    lottery_total_success = sum(r.get("lottery_success", 0) for r in results)
    errors = [r for r in results if r.get("error")]

    print("\n" + "="*30)
    print("                    任务执行汇总")
    print("="*30)
    print(f"总账号数: {total}")
    print(f"签到成功总活动数: {sign_success_total}")
    print(f"抽奖成功总次数: {lottery_total_success}")
    if errors:
        print(f"异常账号数: {len(errors)}")
        for err in errors:
            print(f"  - {err.get('remark', '未知')} ({err.get('openId', '')[:8]}...): {err.get('error')}")
    print("="*30)

if __name__ == "__main__":
    accounts = load_accounts_from_env()
    if not accounts:
        exit(1)

    max_workers = int(os.environ.get("TC_MAX_WORKERS", "1"))
    results = run_all_accounts(accounts, max_workers=max_workers)
    print_summary(results)
