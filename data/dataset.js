export const CHINA_CENTER = { lon: 104.5, lat: 35.2 };
export const BEIJING_COORD = { lon: 116.4074, lat: 39.9042 };
export const HAIDIAN_PARK_COORD = { lon: 116.225723, lat: 40.087606 };
export const DESTINATION_NAME = "北京市 海淀区 海淀大悦信息科技园";

export const ROUTE_VIEW_MODE = "two-stage";

export const PHOTO_SET = [
  {
    date: "2024-07-01",
    name: "刘铁岩",
    src: "./data/刘铁岩.png",
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.4554, lat: 39.9388 },
    expertises: ["AI Core", "AI+Science", "教科人培养"]
  },
  {
    date: "2024-07-01",
    name: "宫茜",
    src: "./data/宫茜.jpg",
    focus: { x: 56, y: 50 },
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.4554, lat: 39.9388 },
    expertises: ["AI教育", "智慧校园", "教科人培养"]
  },
  {
    date: "2025-05-15",
    name: "吴衍标",
    src: "./data/吴衍标.jpg",
    originCity: "河源市",
    originCoord: { lon: 114.7004, lat: 23.7435 },
    expertises: ["AI+Industry", "AI+Society", "AI Core"]
  },
  {
    date: "2025-05-15",
    name: "邹欣",
    src: "./data/邹欣.png",
    originCity: "河源市",
    originCoord: { lon: 117.004, lat: 23.7435 },
    expertises: ["AI+Science", "AI+Industry", "AI教育"]
  },
  {
    date: "2025-07-15",
    name: "郑书新",
    src: "./data/郑书新.jpg",
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.3074, lat: 39.9841 },
    expertises: ["AI+Industry", "AI Core", "教科人培养"]
  },
  {
    date: "2025-07-15",
    name: "凌家欣",
    src: "./data/凌家欣.jpg",
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.3074, lat: 39.9841 },
    expertises: ["AI+Industry", "AI+Society", "智慧校园"]
  },
  {
    date: "2025-07-15",
    name: "关浩祥",
    src: "./data/关浩祥.jpg",
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.3074, lat: 39.9841 },
    expertises: ["AI教育", "教科人培养", "AI Core"]
  },
  {
    date: "2025-07-15",
    name: "常丰祺",
    src: "./data/常丰祺.jpg",
    originCity: "北京市 朝阳区",
    originCoord: { lon: 116.4074, lat: 39.9042 },
    expertises: ["AI+Industry", "AI+Society", "AI教育"]
  },
  {
    date: "2025-07-15",
    name: "赵晨",
    src: "./data/赵晨.jpg",
    originCity: "上海市",
    originCoord: { lon: 121.4737, lat: 31.2304 },
    expertises: ["AI+Industry", "AI+Society", "AI+Science"]
  },
  {
    date: "2026-04-09",
    name: "刘康",
    src: "./data/刘康.jpg",
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.3074, lat: 39.9841 },
    expertises: ["AI Core", "AI+Science", "AI教育"]
  },
  {
    date: "2026-04-16",
    name: "孙晓明",
    src: "./data/孙晓明.png",
    originCity: "北京市 海淀区",
    originCoord: { lon: 116.3074, lat: 39.9841 },
    expertises: ["AI Core", "AI+Science", "AI+Industry"]
  }
].sort((a, b) => a.date.localeCompare(b.date));

export const MAP_SOURCES = {
  china: {
    label: "China",
    errorLabel: "china.geojson",
    sources: [
      "./china.geojson",
      "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json"
    ],
    minVisibleLat: 17.8
  },
  beijing: {
    label: "Beijing",
    errorLabel: "Beijing.geojson",
    sources: [
      "./Beijing.geojson",
      "https://geo.datav.aliyun.com/areas_v3/bound/110000_full.json"
    ],
    minVisibleLat: null
  }
};
