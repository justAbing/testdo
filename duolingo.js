[rewrite_local]
^https?:\/\/(?:ios-api-[^.]+|api[^.]+)\.duolingo\.[a-z.]+\/.*\/users\/.*\?fields=subscriberLevel url script-response-body https://raw.githubusercontent.com/justAbing/testdo/refs/heads/main/tota.js, tag=订购等级
^https?:\/\/(?:ios-api-[^.]+|api[^.]+)\.duolingo\.[a-z.]+\/.*\/users\/.*\/available-features.*$ url script-response-body https://raw.githubusercontent.com/justAbing/testdo/refs/heads/main/tota.js, tag=订购配置
^https?:\/\/(?:ios-api-[^.]+|api[^.]+)\.duolingo\.[a-z.]+\/\d{4}-\d{1,2}-\d{1,2}\/batch url script-response-body https://raw.githubusercontent.com/justAbing/testdo/refs/heads/main/tota.js, tag=订购信息
[mitm]
hostname = ios-api-*.duolingo.*, api*.duolingo.*
