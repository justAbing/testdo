// 处理 subscriberLevel
if ($request.url.indexOf("fields=subscriberLevel") !== -1) {
  let obj = { "subscriberLevel": "GOLD" };
  $done({ body: JSON.stringify(obj) });
}

// 处理 available-features
else if ($request.url.indexOf("available-features") !== -1) {
  let obj = {
    "subscriptionFeatures": ["NO_NETWORK_ADS","UNLIMITED_HEARTS","LEGENDARY_LEVEL","MISTAKES_INBOX","MASTERY_QUIZ","NO_SUPER_PROMOS","LICENSED_SONGS","CHAT_TUTORS","VIDEO_CALL_IN_PATH","VIDEO_CALL_IN_PRACTICE_HUB","CAN_ADD_SECONDARY_MEMBERS"],
    "purchasableFeatures": ["CAN_PURCHASE_IAP", "CAN_PURCHASE_SUBSCRIPTION"]
  };
  $done({ body: JSON.stringify(obj) });
}

// 处理 batch 订阅信息
else if ($request.url.match(/\/\d{4}-\d{1,2}-\d{1,2}\/batch/)) {
  var response = JSON.parse($response.body);
  var innerBody = JSON.parse(response.responses[0].body);

  if (!innerBody.shopItems) innerBody.shopItems = [];
  if (!innerBody.subscriptionConfigs) innerBody.subscriptionConfigs = [];

  var shopMaxSub = {
    "purchaseId": "123xxx321yyy1234567890",
    "purchaseDate": 1758267353,
    "purchasePrice": 249,
    "id": "gold_subscription",
    "itemName": "gold_subscription",
    "subscriptionInfo": {
      "currency": "USD",
      "expectedExpiration": 2758872153,
      "isFreeTrialPeriod": true,
      "isIntroOfferPeriod": false,
      "isInBillingRetryPeriod": false,
      "periodLength": 12,
      "price": 99999,
      "productId": "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.25Q2WB7D.Trial7.240",
      "renewer": "APPLE",
      "renewing": true,
      "tier": "twelve_month",
      "type": "gold",
      "vendorPurchaseId": "123456789012345",
      "promotionalOfferId": ""
    },
    "familyPlanInfo": {
      "ownerId": 1234567890,
      "secondaryMembers": [],
      "inviteToken": "1-AAAA-1234-MMMM-BBBB",
      "pendingInvites": [],
      "pendingInviteSuggestions": []
    }
  };

  var configMaxSub = {
    "subscriptionConfigs": [
      {
        "vendorPurchaseId": "123456789012345",
        "isInBillingRetryPeriod": false,
        "isInGracePeriod": false,
        "pauseStart": 2758872153,
        "pauseEnd": null,
        "productId": "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.25Q2WB7D.Trial7.240",
        "receiptSource": 1,
        "expirationTimestamp": 2758872153000,
        "isFreeTrialPeriod": true,
        "itemType": "gold_subscription"
      }
    ]
  };

  innerBody.shopItems.push(shopMaxSub);
  innerBody.subscriptionConfigs.push(...configMaxSub.subscriptionConfigs);
  innerBody.trackingProperties.has_item_gold_subscription = true;
  innerBody.subscriberLevel = "GOLD";
  innerBody.trackingProperties.monetizable_status = "free_trial_owner_max";
  innerBody.timerBoostConfig.timerBoosts = 8;
  innerBody.timerBoostConfig.hasPurchasedTimerBoost = true;

  response.responses[0].body = JSON.stringify(innerBody);
  $done({ body: JSON.stringify(response) });
}

// 其他请求不处理
else {
  $done({});
}
