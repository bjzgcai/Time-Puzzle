export const CHINA_CENTER = { lon: 104.5, lat: 35.2 };
export const BEIJING_COORD = { lon: 116.4074, lat: 39.9042 };
export const HAIDIAN_PARK_COORD = { lon: 116.225723, lat: 40.087606 };
export const DESTINATION_NAME = "北京市 海淀区 海淀大悦信息科技园";

export const ROUTE_VIEW_MODE = "two-stage"; // "two-stage" | "single-map"

export const PHOTO_SET = [
  {
    date: "2026-03-26",
    name: "吴衍标",
    src: "./data/吴衍标.jpg",
    originCity: "河源市",
    originCoord: { lon: 114.7004, lat: 23.7435 }
  },
  {
    date: "2026-03-30",
    name: "邹欣",
    src: "./data/邹欣.png",
    originCity: "北京市 朝阳区 三里屯",
    originCoord: { lon: 116.4554, lat: 39.9388 }
  },
  {
    date: "2026-04-02",
    name: "李闻舟",
    src: "./data/mock-avatar-1.svg",
    originCity: "成都市",
    originCoord: { lon: 104.0665, lat: 30.5728 }
  },
  {
    date: "2026-04-02",
    name: "周青禾",
    src: "./data/mock-avatar-2.svg",
    originCity: "杭州市",
    originCoord: { lon: 120.1551, lat: 30.2741 }
  },
  {
    date: "2026-04-02",
    name: "陈星野",
    src: "./data/mock-avatar-3.svg",
    originCity: "武汉市",
    originCoord: { lon: 114.3055, lat: 30.5928 }
  },
  {
    date: "2026-04-02",
    name: "林初夏",
    src: "./data/mock-avatar-4.svg",
    originCity: "西安市",
    originCoord: { lon: 108.9398, lat: 34.3416 }
  },
  {
    date: "2026-04-02",
    name: "宋以宁",
    src: "./data/mock-avatar-5.svg",
    originCity: "厦门市",
    originCoord: { lon: 118.0894, lat: 24.4798 }
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
