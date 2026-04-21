[rewrite_local]
^https?:\/\/(?:ios-api-[^.]+|api[^.]+)\.duolingo\.[a-z.]+\/.*\/users\/.*\?fields=subscriberLevel url script-response-body https://github.com/justAbing/testdo/blob/0eb42f2f06aa1bd8fb28de581a9429954479e8cf/duolingoleve.js
, tag=订购等级
^https?:\/\/(?:ios-api-[^.]+|api[^.]+)\.duolingo\.[a-z.]+\/.*\/users\/.*\/available-features.*$ url script-response-body https://github.com/justAbing/testdo/blob/0eb42f2f06aa1bd8fb28de581a9429954479e8cf/duolingo.js, tag=订购配置
^https?:\/\/(?:ios-api-[^.]+|api[^.]+)\.duolingo\.[a-z.]+\/\d{4}-\d{1,2}-\d{1,2}\/batch url script-response-body https://github.com/justAbing/testdo/blob/0eb42f2f06aa1bd8fb28de581a9429954479e8cf/batch.js
, tag=订购信息
[mitm]
hostname = ios-api-*.duolingo.*, api*.duolingo.*
