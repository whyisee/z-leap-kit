export type BuiltinWorldEntity = {
  externalId: string;
  entityType: string;
  canonicalName: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
};

export const builtinWorldEntityCatalogVersion = "2026-08-11.1";

export const builtinWorldEntities: BuiltinWorldEntity[] = [
  { externalId: "app:wechat", entityType: "app", canonicalName: "微信", aliases: ["WeChat"] },
  { externalId: "app:alipay", entityType: "app", canonicalName: "支付宝", aliases: ["Alipay"] },
  { externalId: "app:douyin", entityType: "app", canonicalName: "抖音", aliases: ["Douyin"] },
  { externalId: "app:bilibili", entityType: "app", canonicalName: "哔哩哔哩", aliases: ["B站", "bilibili"] },
  { externalId: "app:xiaohongshu", entityType: "app", canonicalName: "小红书", aliases: ["RED"] },
  { externalId: "app:weibo", entityType: "app", canonicalName: "微博", aliases: ["新浪微博"] },
  { externalId: "app:zhihu", entityType: "app", canonicalName: "知乎" },
  { externalId: "app:douban", entityType: "app", canonicalName: "豆瓣" },
  { externalId: "app:taobao", entityType: "app", canonicalName: "淘宝", aliases: ["手机淘宝"] },
  { externalId: "app:jd", entityType: "app", canonicalName: "京东", aliases: ["京东商城"] },
  { externalId: "app:meituan", entityType: "app", canonicalName: "美团" },
  { externalId: "app:eleme", entityType: "app", canonicalName: "饿了么" },
  { externalId: "app:amap", entityType: "app", canonicalName: "高德地图" },
  { externalId: "app:baidu-map", entityType: "app", canonicalName: "百度地图" },
  { externalId: "app:qq", entityType: "app", canonicalName: "QQ" },
  { externalId: "app:netease-cloud-music", entityType: "app", canonicalName: "网易云音乐", aliases: ["网易云"] },
  { externalId: "app:qq-music", entityType: "app", canonicalName: "QQ音乐" },
  { externalId: "app:keep", entityType: "app", canonicalName: "Keep" },
  { externalId: "app:steam", entityType: "app", canonicalName: "Steam" },
  { externalId: "app:youtube", entityType: "app", canonicalName: "YouTube" },
  { externalId: "app:netflix", entityType: "app", canonicalName: "Netflix" },

  { externalId: "food:baozi", entityType: "food", canonicalName: "包子" },
  { externalId: "food:dumpling", entityType: "food", canonicalName: "饺子" },
  { externalId: "food:rice", entityType: "food", canonicalName: "米饭" },
  { externalId: "food:noodles", entityType: "food", canonicalName: "面条", aliases: ["面"] },
  { externalId: "food:hotpot", entityType: "food", canonicalName: "火锅" },
  { externalId: "food:barbecue", entityType: "food", canonicalName: "烧烤" },
  { externalId: "food:fried-rice", entityType: "food", canonicalName: "炒饭" },
  { externalId: "food:congee", entityType: "food", canonicalName: "粥" },
  { externalId: "food:bread", entityType: "food", canonicalName: "面包" },
  { externalId: "food:cake", entityType: "food", canonicalName: "蛋糕" },
  { externalId: "food:salad", entityType: "food", canonicalName: "沙拉" },
  { externalId: "food:steak", entityType: "food", canonicalName: "牛排" },
  { externalId: "food:pizza", entityType: "food", canonicalName: "披萨", aliases: ["比萨"] },
  { externalId: "food:hamburger", entityType: "food", canonicalName: "汉堡" },
  { externalId: "food:rice-noodles", entityType: "food", canonicalName: "米粉" },
  { externalId: "food:malatang", entityType: "food", canonicalName: "麻辣烫" },

  { externalId: "drink:coffee", entityType: "drink", canonicalName: "咖啡" },
  { externalId: "drink:tea", entityType: "drink", canonicalName: "茶" },
  { externalId: "drink:milk-tea", entityType: "drink", canonicalName: "奶茶" },
  { externalId: "drink:milk", entityType: "drink", canonicalName: "牛奶" },
  { externalId: "drink:cola", entityType: "drink", canonicalName: "可乐" },
  { externalId: "drink:juice", entityType: "drink", canonicalName: "果汁" },
  { externalId: "drink:beer", entityType: "drink", canonicalName: "啤酒" },
  { externalId: "drink:water", entityType: "drink", canonicalName: "水", aliases: ["矿泉水"] },

  { externalId: "game:honor-of-kings", entityType: "game", canonicalName: "王者荣耀" },
  { externalId: "game:peacekeeper-elite", entityType: "game", canonicalName: "和平精英" },
  { externalId: "game:genshin-impact", entityType: "game", canonicalName: "原神" },
  { externalId: "game:league-of-legends", entityType: "game", canonicalName: "英雄联盟", aliases: ["LOL"] },
  { externalId: "game:minecraft", entityType: "game", canonicalName: "我的世界", aliases: ["Minecraft"] },
  { externalId: "game:counter-strike-2", entityType: "game", canonicalName: "Counter-Strike 2", aliases: ["CS2"] },
  { externalId: "game:stardew-valley", entityType: "game", canonicalName: "星露谷物语" },
  { externalId: "game:animal-crossing", entityType: "game", canonicalName: "集合啦！动物森友会", aliases: ["动物森友会"] },

  { externalId: "brand:starbucks", entityType: "brand", canonicalName: "星巴克", aliases: ["Starbucks"] },
  { externalId: "brand:mcdonalds", entityType: "brand", canonicalName: "麦当劳", aliases: ["McDonald's"] },
  { externalId: "brand:kfc", entityType: "brand", canonicalName: "肯德基", aliases: ["KFC"] },
  { externalId: "brand:haidilao", entityType: "brand", canonicalName: "海底捞" },
];
