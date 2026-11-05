/* ============================================================
 * z'star · 深空宇宙探索 — 天体数据库
 * by xuran zhou · CC BY-NC 4.0
 * ============================================================ */
window.ZDATA = (function () {
  'use strict';

  /* ---------- 主题配色（多种颜色渐变切换） ---------- */
  var THEMES = [
    {
      id: 'nebula', name: '星云紫',
      c1: '#8a2be2', c2: '#ff2d95', c3: '#4dd0ff',
      nebula: ['#7b2ff7', '#f107a3', '#3a0ca3', '#b5179e'],
      orbit: '#a06bff', accent: '#c084fc', bodyBg: '#0a0416'
    },
    {
      id: 'deep', name: '深空蓝',
      c1: '#00c6ff', c2: '#0051ff', c3: '#7afaff',
      nebula: ['#0072ff', '#00c6ff', '#03045e', '#0096c7'],
      orbit: '#4dc3ff', accent: '#38bdf8', bodyBg: '#030814'
    },
    {
      id: 'aurora', name: '极光绿',
      c1: '#00f5a0', c2: '#00b3ff', c3: '#a7ff83',
      nebula: ['#00b894', '#00f5a0', '#01411c', '#08a045'],
      orbit: '#3ef0a8', accent: '#34d399', bodyBg: '#02120c'
    },
    {
      id: 'ember', name: '绯红余烬',
      c1: '#ff512f', c2: '#dd2476', c3: '#ffb347',
      nebula: ['#dd2476', '#ff512f', '#6a040f', '#d00000'],
      orbit: '#ff7b6b', accent: '#fb7185', bodyBg: '#14040a'
    }
  ];

  /* ---------- 画质档位 ---------- */
  var QUALITY = {
    high: { dpr: 2.0, stars: 6000, belt: 2000, kuiper: 2600, seg: 48, nebula: 9 },
    mid:  { dpr: 1.5, stars: 3500, belt: 1100, kuiper: 1500, seg: 32, nebula: 6 },
    low:  { dpr: 1.0, stars: 1800, belt: 600,  kuiper: 800,  seg: 20, nebula: 4 }
  };

  /* ---------- 太阳系 ----------
   * radius: 场景半径（艺术化比例）；orbit: 场景轨道半径
   * period: 公转周期（天）；spin: 自转周期（天，负数=逆行）
   * tilt: 轴倾角（度）；phase: J2000 平黄经（度）
   * dist 表示真实天文数据（直径 km、距日 km 等）*/
  var SOLAR = {
    sun: {
      id: 'sun', name: '太阳', en: 'The Sun', type: '恒星',
      radius: 5.2, spin: 25.4, tilt: 7.25,
      tex: { kind: 'sun' },
      data: {
        '直径': '1,392,700 km（约地球 109 倍）',
        '质量': '1.989×10³⁰ kg（占太阳系 99.86%）',
        '表面温度': '约 5,500 ℃',
        '核心温度': '约 1,500 万 ℃',
        '年龄': '约 46 亿年',
        '光谱型': 'G2V 黄矮星'
      },
      desc: '太阳系的绝对主宰，一颗中年黄矮星。它每秒将约 400 万吨物质转化为能量，光需要 8 分 20 秒才能到达地球。所有行星、彗星与尘埃都在它的引力支配下运转。'
    },
    planets: [
      {
        id: 'mercury', name: '水星', en: 'Mercury', type: '类地行星',
        radius: 0.55, orbit: 12, period: 88, spin: 58.6, tilt: 0.03, phase: 252.25, inc: 7,
        tex: { kind: 'rock', base: ['#9c8e82', '#6e625a'], craters: 90 },
        data: {
          '直径': '4,879 km', '距日': '5,790 万 km（0.39 AU）',
          '公转': '88 天', '自转': '58.6 天',
          '温度': '-173 ℃ ～ 427 ℃', '卫星': '无'
        },
        desc: '离太阳最近、也是最小的行星。没有大气保温，昼夜温差高达 600 ℃。它的表面布满陨石坑，酷似月球，一天（日出到日出）却长达 176 个地球日。'
      },
      {
        id: 'venus', name: '金星', en: 'Venus', type: '类地行星',
        radius: 0.95, orbit: 17, period: 224.7, spin: -243, tilt: 177.4, phase: 181.98, inc: 3.4,
        tex: { kind: 'swirl', base: ['#e8d8a8', '#c9a86a', '#f5eedd'] },
        data: {
          '直径': '12,104 km', '距日': '1.082 亿 km（0.72 AU）',
          '公转': '224.7 天', '自转': '243 天（逆向）',
          '表面温度': '约 464 ℃', '气压': '地球的 92 倍'
        },
        desc: '地球的“邪恶双胞胎”。浓密的二氧化碳大气造成失控温室效应，使它成为太阳系最热的行星；硫酸云层永远遮蔽天空。它逆向自转——在金星上，太阳从西边升起。'
      },
      {
        id: 'earth', name: '地球', en: 'Earth', type: '类地行星',
        radius: 1.05, orbit: 23, period: 365.25, spin: 1, tilt: 23.44, phase: 100.46, inc: 0,
        tex: { kind: 'earth' },
        atmo: '#6ab7ff',
        data: {
          '直径': '12,742 km', '距日': '1.496 亿 km（1 AU）',
          '公转': '365.25 天', '自转': '23 时 56 分',
          '平均温度': '15 ℃', '卫星': '1 颗（月球）'
        },
        desc: '目前已知唯一孕育生命的星球。液态水覆盖 71% 的表面，磁场与臭氧层为生命撑起保护伞。从深空回望，它只是一粒悬浮在阳光中的蔚蓝尘埃。',
        moons: [{
          id: 'moon', name: '月球', en: 'The Moon', type: '卫星',
          radius: 0.29, dist: 2.8, period: 27.3,
          tex: { kind: 'rock', base: ['#b8b4ae', '#8a857e'], craters: 120 },
          data: { '直径': '3,476 km', '距地': '38.4 万 km', '公转': '27.3 天（潮汐锁定）', '成因': '大碰撞假说' },
          desc: '地球唯一的天然卫星，稳定地轴、驱动潮汐。1969 年阿波罗 11 号在此留下人类第一个地外脚印。'
        }]
      },
      {
        id: 'mars', name: '火星', en: 'Mars', type: '类地行星',
        radius: 0.75, orbit: 30, period: 687, spin: 1.03, tilt: 25.19, phase: 355.43, inc: 1.85,
        tex: { kind: 'mars' },
        atmo: '#ff9e6b',
        data: {
          '直径': '6,779 km', '距日': '2.279 亿 km（1.52 AU）',
          '公转': '687 天', '自转': '24 时 37 分',
          '平均温度': '-63 ℃', '卫星': '2 颗'
        },
        desc: '红色源自表面的氧化铁。这里有太阳系最高的火山——21 公里高的奥林帕斯山，和水手号大峡谷。远古河床与湖泊沉积表明它曾温暖湿润，是人类星际移民的头号候选地。',
        moons: [
          {
            id: 'phobos', name: '火卫一', en: 'Phobos', type: '卫星',
            radius: 0.12, dist: 1.7, period: 0.32,
            tex: { kind: 'rock', base: ['#8f8078', '#5f554e'], craters: 40 },
            data: { '尺寸': '27 × 22 × 18 km', '公转': '7 小时 39 分', '命运': '数千万年后撞向火星或解体成环' },
            desc: '一块被俘获的土豆状岩石，公转比火星自转还快——在火星表面看，它西升东落，一天两次。'
          },
          {
            id: 'deimos', name: '火卫二', en: 'Deimos', type: '卫星',
            radius: 0.1, dist: 2.4, period: 1.26,
            tex: { kind: 'rock', base: ['#a3958c', '#6e625a'], craters: 24 },
            data: { '尺寸': '15 × 12 × 11 km', '公转': '30.3 小时' },
            desc: '太阳系最小的卫星之一，表面平滑覆盖着尘埃，从火星上看只是一颗亮星。'
          }
        ]
      },
      {
        id: 'jupiter', name: '木星', en: 'Jupiter', type: '气态巨行星',
        radius: 2.9, orbit: 46, period: 4333, spin: 0.41, tilt: 3.13, phase: 34.35, inc: 1.3,
        tex: { kind: 'bands', palette: ['#d8c9a3', '#b59a72', '#8a6a4a', '#e8dcc0', '#a5713f'], bands: 14, wobble: 0.8, spot: true },
        atmo: '#ffd9a0',
        data: {
          '直径': '139,820 km（地球 11 倍）', '距日': '7.785 亿 km（5.2 AU）',
          '公转': '11.86 年', '自转': '9 时 56 分（最快）',
          '质量': '其他行星总和的 2.5 倍', '卫星': '95+ 颗'
        },
        desc: '太阳系的巨无霸与保镖，用强大引力清扫彗星与小行星。大红斑是一场刮了至少 350 年的反气旋风暴，能装下整个地球。木卫二冰下海洋是寻找地外生命的热门目标。',
        moons: [
          {
            id: 'io', name: '木卫一', en: 'Io', type: '卫星',
            radius: 0.3, dist: 4.4, period: 1.77,
            tex: { kind: 'io' },
            data: { '直径': '3,643 km', '公转': '1.77 天', '特色': '太阳系火山最活跃天体' },
            desc: '被木星潮汐力反复揉搓，表面遍布 400 多座活火山，硫磺把它染成蛋黄与橙红。'
          },
          {
            id: 'europa', name: '木卫二', en: 'Europa', type: '卫星',
            radius: 0.27, dist: 5.4, period: 3.55,
            tex: { kind: 'europa' },
            data: { '直径': '3,122 km', '公转': '3.55 天', '特色': '冰壳下藏着全球性液态海洋' },
            desc: '光滑冰壳上布满红褐色裂纹，冰下 100 公里处的咸海水量可能是地球所有海洋之和——生命探测的下一站。'
          },
          {
            id: 'ganymede', name: '木卫三', en: 'Ganymede', type: '卫星',
            radius: 0.42, dist: 6.6, period: 7.15,
            tex: { kind: 'rock', base: ['#a89a8a', '#6e625a'], craters: 60 },
            data: { '直径': '5,268 km', '公转': '7.15 天', '特色': '太阳系最大卫星，比水星还大' },
            desc: '太阳系最大的卫星，也是唯一拥有自身磁场的卫星，地下同样藏有咸水海洋。'
          },
          {
            id: 'callisto', name: '木卫四', en: 'Callisto', type: '卫星',
            radius: 0.38, dist: 8.0, period: 16.7,
            tex: { kind: 'rock', base: ['#7d7268', '#4d443c'], craters: 140 },
            data: { '直径': '4,821 km', '公转': '16.7 天', '特色': '太阳系陨石坑最密集的天体' },
            desc: '一张 40 多亿年未曾更新的“老脸”，坑坑洼洼的表面记录了太阳系早期的轰炸史。'
          }
        ]
      },
      {
        id: 'saturn', name: '土星', en: 'Saturn', type: '气态巨行星',
        radius: 2.5, orbit: 61, period: 10759, spin: 0.45, tilt: 26.73, phase: 50.08, inc: 2.49,
        tex: { kind: 'bands', palette: ['#e8d9b0', '#d0bd8a', '#c2ab74', '#f0e6c8', '#b09a68'], bands: 10, wobble: 0.5 },
        rings: { inner: 3.1, outer: 5.9 },
        atmo: '#ffe8b0',
        data: {
          '直径': '116,460 km', '距日': '14.34 亿 km（9.5 AU）',
          '公转': '29.4 年', '自转': '10 时 33 分',
          '密度': '0.687 g/cm³（比水还轻）', '卫星': '146+ 颗'
        },
        desc: '戴着太阳系最壮丽光环的行星——环由数万亿块冰砾组成，宽 28 万公里却薄如纸。它密度小于水，若有足够大的浴缸，土星可以浮起来。',
        moons: [
          {
            id: 'titan', name: '土卫六', en: 'Titan', type: '卫星',
            radius: 0.4, dist: 6.8, period: 15.9,
            tex: { kind: 'swirl', base: ['#d8a04a', '#b57a30', '#e8c070'] },
            atmo: '#ffb45c',
            data: { '直径': '5,150 km', '公转': '15.9 天', '特色': '唯一有浓密大气与液态甲烷湖的卫星' },
            desc: '比水星还大的橙色世界，甲烷雨与碳氢化合物湖泊构成完整的“水循环”。惠更斯号 2005 年在此降落，蜻蜓号任务即将再访。'
          },
          {
            id: 'enceladus', name: '土卫二', en: 'Enceladus', type: '卫星',
            radius: 0.18, dist: 4.4, period: 1.37,
            tex: { kind: 'ice' },
            data: { '直径': '504 km', '公转': '1.37 天', '特色': '南极喷泉喷射冰羽直达太空' },
            desc: '一颗会“喷水”的雪球。南极虎纹裂缝喷出的冰羽源自冰下海洋，卡西尼号曾在其中检测到有机分子。'
          },
          {
            id: 'rhea', name: '土卫五', en: 'Rhea', type: '卫星',
            radius: 0.22, dist: 5.6, period: 4.52,
            tex: { kind: 'ice' },
            data: { '直径': '1,528 km', '公转': '4.5 天' },
            desc: '土星第二大卫星，一颗布满冰坑的古老冰球，可能拥有稀薄的氧气大气层。'
          },
          {
            id: 'iapetus', name: '土卫八', en: 'Iapetus', type: '卫星',
            radius: 0.2, dist: 8.6, period: 79.3,
            tex: { kind: 'rock', base: ['#9a8a72', '#3a3128'], craters: 70 },
            data: { '直径': '1,469 km', '公转': '79.3 天', '特色': '阴阳脸：一面漆黑一面雪白' },
            desc: '太阳系的“阴阳脸”，一半黑如煤、一半白如雪，赤道上还隆起一道神秘的山脊，像一颗胡桃。'
          },
          {
            id: 'mimas', name: '土卫一', en: 'Mimas', type: '卫星',
            radius: 0.14, dist: 3.8, period: 0.94,
            tex: { kind: 'rock', base: ['#c8c4bc', '#8a857e'], craters: 80 },
            data: { '直径': '396 km', '公转': '22.6 小时', '特色': '赫歇尔撞击坑直径达卫星的 1/3' },
            desc: '因巨大的赫歇尔撞击坑而酷似“死星”。2024 年研究发现它的冰壳下竟也藏着一片年轻海洋。'
          }
        ]
      },
      {
        id: 'uranus', name: '天王星', en: 'Uranus', type: '冰巨行星',
        radius: 1.7, orbit: 75, period: 30687, spin: -0.72, tilt: 97.77, phase: 314.06, inc: 0.77,
        tex: { kind: 'bands', palette: ['#bfeef0', '#a8dde4', '#c8f0f2', '#9ad4de'], bands: 6, wobble: 0.3 },
        rings: { inner: 2.4, outer: 3.1, faint: true },
        atmo: '#aef0f2',
        data: {
          '直径': '50,724 km', '距日': '28.71 亿 km（19.2 AU）',
          '公转': '84 年', '自转': '17 时 14 分（逆向）',
          '轴倾角': '97.8°（躺着转）', '卫星': '27 颗'
        },
        desc: '一颗“躺着”公转的行星，可能因远古巨型撞击而翻倒。大气中的甲烷吸收红光，把它染成淡青色；每个极点会经历长达 42 年的极昼与极夜。',
        moons: [
          {
            id: 'titania', name: '天卫三', en: 'Titania', type: '卫星',
            radius: 0.22, dist: 3.6, period: 8.7,
            tex: { kind: 'ice' },
            data: { '直径': '1,578 km', '公转': '8.7 天' },
            desc: '天王星最大卫星，表面纵横交错着上千公里长的巨大峡谷。'
          },
          {
            id: 'oberon', name: '天卫四', en: 'Oberon', type: '卫星',
            radius: 0.2, dist: 4.4, period: 13.5,
            tex: { kind: 'rock', base: ['#a89a92', '#6e625a'], craters: 90 },
            data: { '直径': '1,523 km', '公转': '13.5 天' },
            desc: '天王星最外侧的大卫星，坑底沉积着神秘的黑色物质。'
          },
          {
            id: 'miranda', name: '天卫五', en: 'Miranda', type: '卫星',
            radius: 0.13, dist: 2.8, period: 1.41,
            tex: { kind: 'rock', base: ['#c0bab2', '#8a857e'], craters: 50 },
            data: { '直径': '472 km', '公转': '1.4 天', '特色': '20 km 高的维罗纳断崖' },
            desc: '太阳系的“科学怪人卫星”，地形支离破碎仿佛被撞碎后拼回。维罗纳断崖高 20 公里——跳下去要整整 12 分钟才会着地。'
          }
        ]
      },
      {
        id: 'neptune', name: '海王星', en: 'Neptune', type: '冰巨行星',
        radius: 1.65, orbit: 88, period: 60190, spin: 0.67, tilt: 28.32, phase: 304.35, inc: 1.77,
        tex: { kind: 'neptune' },
        atmo: '#5c8dff',
        data: {
          '直径': '49,244 km', '距日': '44.95 亿 km（30.1 AU）',
          '公转': '164.8 年', '自转': '16 时 6 分',
          '风速': '最高 2,100 km/h（太阳系之最）', '卫星': '14 颗'
        },
        desc: '第一颗“用笔尖算出来”的行星——天文学家先由天王星轨道摄动预言，再于 1846 年找到它。深蓝大气中咆哮着太阳系最快的风，旅行者 2 号是唯一到访的探测器。',
        moons: [
          {
            id: 'triton', name: '海卫一', en: 'Triton', type: '卫星',
            radius: 0.26, dist: 3.9, period: -5.88,
            tex: { kind: 'swirl', base: ['#e8cfc0', '#d0a890', '#f0e0d5'] },
            data: { '直径': '2,707 km', '公转': '5.9 天（逆行）', '特色': '低温 -235 ℃，氮气间歇泉' },
            desc: '太阳系唯一逆行公转的大卫星，很可能是被俘获的柯伊伯带天体。表面的氮气冰间歇泉会喷出 8 公里高的黑烟。'
          },
          {
            id: 'proteus', name: '海卫八', en: 'Proteus', type: '卫星',
            radius: 0.17, dist: 2.9, period: 1.12,
            tex: { kind: 'rock', base: ['#8a8078', '#554e48'], craters: 60 },
            data: { '直径': '420 km', '公转': '26.9 小时' },
            desc: '一颗形状不规则的暗色卫星，再大一点就会被自身引力压成球形。'
          }
        ]
      }
    ],
    dwarfs: [
      {
        id: 'ceres', name: '谷神星', en: 'Ceres', type: '矮行星',
        radius: 0.32, orbit: 35, period: 1680, spin: 0.38, tilt: 4, phase: 95, inc: 10.6,
        tex: { kind: 'rock', base: ['#9a9288', '#6a625a'], craters: 110 },
        data: { '直径': '940 km', '位置': '小行星带', '公转': '4.6 年', '特色': '带内最大天体，占小行星带总质量 1/3' },
        desc: '小行星带的“女王”，也是离太阳最近的矮行星。奥卡托陨石坑内的亮斑是咸水蒸发留下的盐霜，暗示地下可能藏着卤水层。'
      },
      {
        id: 'pluto', name: '冥王星', en: 'Pluto', type: '矮行星',
        radius: 0.45, orbit: 101, period: 90560, spin: 6.39, tilt: 122.5, phase: 238.93, inc: 17.2,
        tex: { kind: 'pluto' },
        atmo: '#c8b8ff',
        data: {
          '直径': '2,377 km', '距日': '39.5 AU（平均）',
          '公转': '248 年', '温度': '-229 ℃',
          '卫星': '5 颗', '地位': '2006 年重分类为矮行星'
        },
        desc: '柯伊伯带的王者。2015 年新视野号飞掠时，在它表面发现了一片氮冰构成的心形平原——“斯普特尼克高原”。它的大气在远离太阳时会凝结降雪。',
        moons: [{
          id: 'charon', name: '冥卫一', en: 'Charon', type: '卫星',
          radius: 0.24, dist: 1.6, period: 6.39,
          tex: { kind: 'rock', base: ['#a89a94', '#7d726c'], craters: 60 },
          data: { '直径': '1,212 km', '公转': '6.4 天（与冥王星互相潮汐锁定）' },
          desc: '大到与冥王星互绕共同质心的“双星伴侶”，北极有一顶暗红色“摩尔多威帽”。'
        }]
      },
      {
        id: 'eris', name: '阋神星', en: 'Eris', type: '矮行星',
        radius: 0.42, orbit: 113, period: 203830, spin: 15.8, tilt: 78, phase: 205, inc: 44.2,
        tex: { kind: 'ice' },
        data: { '直径': '2,326 km', '距日': '约 68 AU', '公转': '559 年', '特色': '它的发现直接导致冥王星“降级”' },
        desc: '比冥王星更重、更远的“麻烦制造者”。2005 年它的现身迫使天文学界重新定义“行星”，冥王星因此退出行星行列。'
      },
      {
        id: 'makemake', name: '鸟神星', en: 'Makemake', type: '矮行星',
        radius: 0.3, orbit: 106, period: 112897, spin: 22.5, tilt: 29, phase: 165, inc: 29,
        tex: { kind: 'swirl', base: ['#c8a080', '#a87858', '#e0c0a0'] },
        data: { '直径': '1,430 km', '距日': '约 45.8 AU', '公转': '306 年', '命名': '复活节岛拉帕努伊神话中的创世神' },
        desc: '一颗泛红的甲烷冰世界，2016 年发现它有一颗昵称 MK2 的小卫星。'
      },
      {
        id: 'haumea', name: '妊神星', en: 'Haumea', type: '矮行星',
        radius: 0.3, orbit: 104, period: 103774, spin: 0.16, tilt: 126, phase: 240, inc: 28.2,
        tex: { kind: 'ice' },
        scale: [1.7, 0.85, 0.9],
        data: { '长径': '约 2,100 km', '公转': '284 年', '自转': '3.9 小时（太阳系最快）', '特色': '拥有自己的光环（2017 年发现）' },
        desc: '被自转甩成橄榄球形的怪异世界，还拖着一圈细环与两颗卫星，堪称柯伊伯带最奇特的天体之一。'
      }
    ],
    halley: {
      id: 'halley', name: '哈雷彗星', en: "Halley's Comet", type: '短周期彗星',
      peri: 10, apo: 96, periodDays: 27394, inc: 14,
      data: {
        '彗核尺寸': '15 × 8 × 8 km', '公转': '约 76 年',
        '上一次回归': '1986 年', '下一次回归': '2061 年 7 月'
      },
      desc: '唯一能用肉眼观测并预言回归周期的著名彗星。每靠近太阳，冰升华产生的彗发与彗尾可横贯半个天空。埃德蒙·哈雷 1705 年预言它约 76 年回归一次——2061 年，它将重返内太阳系。'
    }
  };

  /* ---------- 地球人造卫星（模型 + 简介） ---------- */
  var SATELLITES = [
    {
      id: 'iss', name: '国际空间站', en: 'ISS', dist: 1.9, period: 0.066, inc: 51.6,
      data: { '入轨': '1998 年起分批组装', '轨道高度': '约 400 km', '速度': '7.66 km/s（90 分钟绕地一圈）', '尺寸': '109 m × 73 m' },
      desc: '人类历史上最大的航天器，由 15 国合作建造，自 2000 年 11 月起已连续有人驻留。宇航员在 90 分钟内就能看一次日出日落。'
    },
    {
      id: 'tiangong', name: '天宫空间站', en: 'Tiangong', dist: 2.2, period: 0.064, inc: 41.5,
      data: { '建成': '2022 年底 T 字构型', '轨道高度': '380–400 km', '构型': '天和核心舱 + 问天 / 梦天实验舱' },
      desc: '中国自主建造的国家太空实验室，三舱构型可支持 3 名航天员长期驻留、6 人轮换，是中国人的“太空家园”。'
    },
    {
      id: 'hubble', name: '哈勃空间望远镜', en: 'Hubble Space Telescope', dist: 2.5, period: 0.065, inc: 28.5,
      data: { '发射': '1990 年 4 月 24 日', '轨道高度': '约 540 km', '主镜': '2.4 m', '成果': '13 万+ 观测，深空场改写宇宙学' },
      desc: '史上最多产的望远镜。它测得宇宙年龄约 138 亿年，证实宇宙加速膨胀，那几张“深空场”照片让人类第一次数清了 postage stamp 大小天区里的数千星系。'
    },
    {
      id: 'beidou', name: '北斗三号导航卫星', en: 'BeiDou-3', dist: 2.9, period: 0.77, inc: 55,
      data: { '组网': '2020 年 7 月全球开通', '星座': '约 30 颗（MEO/GEO/IGSO）', '轨道高度': '21,500 km（MEO）' },
      desc: '中国自主的全球导航系统，与 GPS、格洛纳斯、伽利略并列为四大 GNSS。定位、授时、短报文通信，默默守护着每一部手机。'
    },
    {
      id: 'sputnik', name: '斯普特尼克 1 号', en: 'Sputnik 1', dist: 3.3, period: 0.072, inc: 65,
      data: { '发射': '1957 年 10 月 4 日', '质量': '83.6 kg', '信号': '持续 21 天的“哔——哔——”' },
      desc: '人类第一颗人造卫星，一个带着四根天线的金属球。它的哔哔声开启了太空时代，也直接催生了 NASA。'
    },
    {
      id: 'iridium', name: '铱星通信卫星', en: 'Iridium NEXT', dist: 3.6, period: 0.092, inc: 86.4,
      data: { '星座': '66 颗工作星 + 冗余', '轨道高度': '约 780 km', '特色': '全球任意角落的语音 / 数据通信' },
      desc: '用 66 颗卫星把地球包裹起来的“太空蜂窝网”。第一代铱星曾因经营失败险些坠毁销毁，如今的新一代星座还兼职观测飞机与船舶的全球定位。'
    }
  ];

  /* ---------- 太阳系外深空天体 ---------- */
  var DEEP = [
    {
      id: 'sirius', name: '天狼星', en: 'Sirius', build: 'binary', radius: 3.0,
      data: { '距离': '8.6 光年', '类型': 'A1V 主序星 + 白矮星伴星', '视星等': '-1.46（夜空最亮恒星）', '质量': '2.06 M☉' },
      desc: '大犬座的“犬之眼”，除太阳、行星与月亮外全天最亮的恒星。身旁藏着一颗白矮星天狼星 B——一块地球大小却与太阳差不多重的“宇宙钻石”。古埃及人以它的偕日升预报尼罗河泛滥。'
    },
    {
      id: 'canopus', name: '老人星', en: 'Canopus', build: 'star', radius: 3.0, color: '#fff2d8',
      data: { '距离': '约 310 光年', '类型': 'F0 黄白超巨星', '视星等': '-0.74（夜空第二亮）', '光度': '太阳的 1 万倍' },
      desc: '船底座的南极航标，亮度仅次于天狼星。在中国古代它是掌管寿夭的“南极老人星”，北方很难看见，长江以南才能一睹真容。'
    },
    {
      id: 'arcturus', name: '大角星', en: 'Arcturus', build: 'pulsate', radius: 3.4, color: '#ffab5e',
      data: { '距离': '36.7 光年', '类型': 'K1.5 红巨星', '视星等': '-0.05（北天最亮恒星）', '直径': '约太阳 25 倍' },
      desc: '牧夫座的橙色巨星，一颗已经膨胀了的“老年太阳”。它正以每秒 122 公里的高速穿行银河系，再过数千年将漂离我们的视野。1933 年芝加哥世博会用它的光点亮开幕式的“星光之灯”。'
    },
    {
      id: 'vega', name: '织女星', en: 'Vega', build: 'disk', radius: 2.8, color: '#cfe4ff',
      data: { '距离': '25 光年', '类型': 'A0V 蓝白主序星', '视星等': '0.03', '特色': '第一颗被拍下照片的恒星（1850 年）' },
      desc: '七夕传说的女主角，天琴座明珠。约 1.2 万年后，地轴岁差将使它再度成为北极星。1983 年红外卫星在它周围发现尘埃盘——人类第一次直击“行星系统的摇篮”。'
    },
    {
      id: 'betelgeuse', name: '参宿四', en: 'Betelgeuse', build: 'pulsate', radius: 5.0, color: '#ff5c33',
      data: { '距离': '约 550 光年', '类型': 'M1 红超巨星', '直径': '约太阳 900 倍', '状态': '随时（天文尺度上）可能超新星爆发' },
      desc: '猎户座左肩上的红色巨无霸，若放在太阳位置，表面将吞没火星轨道。2019 年末的“大变暗”事件一度让全网猜测它即将爆发——那只是一团尘埃。当它真正爆发时，亮度将胜过满月，白天可见。'
    },
    {
      id: 'rigel', name: '参宿七', en: 'Rigel', build: 'wind', radius: 3.6, color: '#9dc4ff',
      data: { '距离': '约 860 光年', '类型': 'B8 蓝超巨星', '光度': '太阳的约 12 万倍', '质量': '约 21 M☉' },
      desc: '猎户座右脚上的蓝白色超巨星，光度是太阳的十几万倍。如此挥霍意味着寿命极短——数百万年后它将以超新星谢幕。'
    },
    {
      id: 'antares', name: '心宿二', en: 'Antares', build: 'pulsate', radius: 4.8, color: '#ff6a45',
      data: { '距离': '约 550 光年', '类型': 'M1.5 红超巨星', '直径': '约太阳 700 倍', '含义': 'Antares = “火星的对手”' },
      desc: '天蝎座之心，中国古代称“大火”或“商星”。它红得能压过火星——希腊人给它起名“反火星”。杜甫诗中“人生不相见，动如参与商”的“商”，指的正是它。'
    },
    {
      id: 'polaris', name: '北极星', en: 'Polaris', build: 'triple', radius: 2.6, color: '#ffeec8',
      data: { '距离': '约 433 光年', '类型': 'F7 黄超巨星（造父变星）', '作用': '现今天球北极指向', '构型': '三合星系统' },
      desc: '夜空的“不动的锚”。它其实是一颗造父变星——亮度以 3.97 天为周期微微脉动，正是这类恒星帮助人类丈量了宇宙的距离。'
    },
    {
      id: 'alphacen', name: '南门二', en: 'Alpha Centauri', build: 'triple', radius: 2.8, color: '#ffe8c0',
      data: { '距离': '4.37 光年（最近恒星系统）', '构型': 'A + B 双星 + 比邻星', '比邻星': 'M5.5 红矮星，4.24 光年', '行星': '比邻星 b 位于宜居带（2016 年发现）' },
      desc: '离太阳最近的恒星系统，也是《三体》中三体星系的原型。比邻星 b 是距离我们最近的系外岩石行星——人类星际飞船“突破摄星”计划的首个目标。'
    },
    {
      id: 'crab', name: '蟹状星云脉冲星', en: 'Crab Pulsar (PSR B0531+21)', build: 'pulsar', radius: 0.55,
      data: { '距离': '约 6,500 光年', '类型': '中子星 + 超新星遗迹 M1', '自转': '约 30 转 / 秒', '爆发记录': '公元 1054 年（宋代“天关客星”）' },
      desc: '一颗直径仅约 20 公里、却比太阳还重的中子星，每秒自转 30 圈，像灯塔一样扫过宇宙。它的“心脏”是 1054 年那场被宋朝天文官记录的超新星——白昼可见 23 天。'
    },
    {
      id: 'psr1919', name: 'PSR B1919+21', en: 'The First Pulsar', build: 'pulsar', radius: 0.45,
      data: { '发现': '1967 年，约瑟琳·贝尔', '脉冲周期': '1.3373 秒', '类型': '第一颗被发现的中子星（脉冲星）' },
      desc: '1967 年，24 岁的博士生约瑟琳·贝尔在记录纸上发现规律的“哔哔”信号，一度被戏称为 LGM-1（“小绿人”）。这颗脉冲星的发现，最终摘得诺贝尔奖，开启了中子星研究的大门。'
    },
    {
      id: 'magnetar', name: '磁星 SGR 1806-20', en: 'Magnetar SGR 1806-20', build: 'magnetar', radius: 0.5,
      data: { '距离': '约 5 万光年（银心方向）', '类型': '磁星（磁场约 10¹⁵ 高斯）', '纪录': '2004 年爆发为太阳系外最亮的耀斑之一' },
      desc: '宇宙最强磁铁：磁场强度是地球的千万亿倍——如果你在 1000 公里内靠近它，磁场会直接撕碎你的原子。2004 年它的一次耀斑在 0.2 秒内释放的能量，相当于太阳 25 万年的总辐射。'
    },
    {
      id: 'cygx1', name: '天鹅座 X-1', en: 'Cygnus X-1', build: 'blackhole', radius: 1.8,
      data: { '距离': '约 7,200 光年', '类型': '恒星级黑洞（约 21 M☉）', '意义': '第一个被广泛承认的黑洞', '趣闻': '霍金与索恩曾为其打赌' },
      desc: '第一个被“抓到现行”的黑洞。它撕扯着身旁蓝超巨星的物质，发出刺目的 X 射线。霍金曾赌它不是黑洞并认输——为索恩订阅了一年的《阁楼》杂志。'
    },
    {
      id: 'sgra', name: '人马座 A*', en: 'Sagittarius A*', build: 'blackhole', radius: 2.2, stars: true,
      data: { '距离': '约 26,000 光年（银河系中心）', '质量': '约 430 万 M☉', '成像': '2022 年事件视界望远镜（EHT）' },
      desc: '银河系的中央巨兽，所有恒星都绕它旋转。2022 年，事件视界望远镜发布了它的“标准照”——那个发光的橙环，是坠入深渊前最后的挣扎。'
    },
    {
      id: 'm87', name: 'M87*', en: 'Messier 87 Black Hole', build: 'blackhole', radius: 2.4, jet: true,
      data: { '距离': '约 5,350 万光年（室女座星系团）', '质量': '约 65 亿 M☉', '成像': '2019 年 EHT —— 人类首张黑洞照片', '喷流': '延伸近 5,000 光年' },
      desc: '那张举世闻名的“甜甜圈”。2019 年，事件视界望远镜让人类第一次直视黑洞视界的剪影。它抛出的等离子喷流长达数千光年，是星系级的手电筒。'
    },
    {
      id: 'orion', name: '猎户座大星云', en: 'Orion Nebula (M42)', build: 'nebula', radius: 6,
      data: { '距离': '约 1,344 光年', '类型': '弥漫星云 / 恒星育婴室', '观测': '肉眼可见（猎户座腰带下方）', '编号': '梅西耶 M42' },
      desc: '离我们最近的大型恒星工厂。数千颗新生恒星正从气体尘埃中点亮，猎户座四边形聚星是它的“产房灯”。在北半球冬夜，肉眼就能看到这团朦胧的光斑。'
    },
    {
      id: 'pillars', name: '创生之柱', en: 'Pillars of Creation', build: 'nebula', radius: 5.5,
      data: { '距离': '约 6,500 光年（鹰状星云 M16）', '类型': '分子云柱状结构', '名照': '哈勃 1995 / 韦布 2022', '尺寸': '最高约 4 光年' },
      desc: '哈勃望远镜 1995 年拍下的传世名作。几根巨大的冷氢与尘埃柱在紫外线侵蚀下缓慢消散——天文学家推测它们可能早已被一场超新星摧毁，只是噩耗的光还未传到地球。'
    },
    {
      id: 'trappist', name: 'TRAPPIST-1 系统', en: 'TRAPPIST-1 System', build: 'system', radius: 1.8,
      data: { '距离': '40.7 光年（宝瓶座）', '类型': 'M8 红矮星 + 7 颗类地行星', '宜居带': '3 颗（e / f / g）', '发现': '2017 年' },
      desc: '一颗比木星大不了多少的红矮星，却牵着 7 颗几乎同质量的岩石行星，全部轨道塞进水星轨道之内。7 兄弟被锁定在精确的轨道共振链上，是韦布望远镜逐一大气扫描的“头号明星家族”。'
    }
  ];

  /* ---------- 关于 / 免责声明文案 ---------- */
  var ABOUT = {
    intro: 'z\'star 是一座运行在浏览器里的深空天文馆：从太阳的日冕到 6,500 光年外的创生之柱，57 个天体以三维交互的方式在眼前运转。',
    features: [
      '太阳系全景：八大行星、5 颗矮行星、18 颗代表性卫星与哈雷彗星',
      '深空天体：双星、红超巨星、脉冲星、磁星、黑洞与星云共 18 处名胜',
      '时间机器：0.1 ～ 1000 天/秒 无级变速，轨道轨迹随心调整',
      '地球轨道：6 种人造卫星模型与简介',
      '深邃空灵的生成式环境音乐，四种渐变主题随时切换',
      '纯浏览器渲染，无任何数据上传，桌面端与移动端全适配'
    ],
    author: '页面设计、三维场景与全部代码 · by xuran zhou',
    stack: 'Three.js · Web Audio API · Canvas 2D · 原生 JavaScript（所有纹理均由程序实时生成，无外部图片）'
  };

  var DISCLAIMER = [
    '本站为非专业天文科普演示作品。天体大小、距离与轨道均经过艺术化压缩，不能作为真实比例或观测依据。',
    '页面中的天体数据整理自公开科普资料，仅供参考学习；如与最新研究存在出入，请以专业文献为准。',
    '所有行星纹理均由程序噪声实时生成，为示意图而非真实影像；深空天体形态基于公开照片的艺术化再现。',
    '环境音乐由浏览器 Web Audio 实时合成，无任何采样素材。',
    '本站不上传、不收集任何用户数据；页面可离线运行（首次加载需联网获取 Three.js 渲染库）。'
  ];

  /* ---------- 全部卫星（按母行星分组，供构建时补充） ---------- */
  var EXTRA_MOONS = {
    jupiter: [
      { id: 'amalthea', name: '木卫五', en: 'Amalthea', dist: 1.82, period: 0.498, desc: '直径 167 km，太阳系第三大卫星，暗红色 S 型小行星，轨道在 Io 之内。' },
      { id: 'adrastea', name: '木卫十五', en: 'Adrastea', dist: 1.45, period: 0.3, desc: '直径仅 16 km，是木星最内侧的已知卫星，在 Amalthea 轨道之外。' },
      { id: 'thebe', name: '木卫十四', en: 'Thebe', dist: 2.26, period: 0.674, desc: '直径约 100 km，木卫五与 Io 之间，表面有一座相对其自身过大的陨石坑。' },
      { id: 'callisto2', name: '木卫六（希玛莉亚）', en: 'Himalia', dist: 11.6, period: 250, desc: '直径 160 km，最早被发现的两颗不规则卫星之一，很可能是被木星捕获的小行星。' }
    ],
    saturn: [
      { id: 'mimas2', name: '土卫二（恩克拉多斯）', en: 'Enceladus', dist: 3.2, period: 1.37, desc: '直径 504 km，南极喷泉直接喷射入太空，2024 年 NASA 发现其地下海洋可能正在形成。' },
      { id: 'tethys', name: '土卫三', en: 'Tethys', dist: 3.7, period: 1.89, desc: '直径 1066 km，几乎全由纯水冰构成，一道 2000 km 长的奥德赛大裂谷横贯其身。' },
      { id: 'dione', name: '土卫四', en: 'Dione', dist: 4.1, period: 2.74, desc: '直径 1123 km，冰壳上覆盖着稀薄的氧气大气。' },
      { id: 'helene', name: '土卫十二', en: 'Helene', dist: 4.8, period: 2.74, desc: '直径 36 km，与 Dione 共享轨道，位于后者的拉格朗日 L4 点，是罕见的特洛伊卫星。' },
      { id: 'polydeuces', name: '土卫三十四', en: 'Polydeuces', dist: 4.8, period: 2.74, desc: '直径仅 3 km，Dione 轨道上的另一颗特洛伊卫星（L5 点）。' },
      { id: 'rhea2', name: '土卫五', en: 'Rhea', dist: 5.7, period: 4.52, desc: '直径 1528 km，土星第二大卫星，有稀薄氧气大气，表面冰坑上有古老的断裂带。' },
      { id: 'titan2', name: '土卫六', en: 'Titan', dist: 6.6, period: 15.9, desc: '直径 5150 km，比水星还大。唯一有浓密大气的卫星，地表有甲烷湖与乙烷海，2023 年 NASA 蜻蜓号任务再次造访。' },
      { id: 'iapetus2', name: '土卫八', en: 'Iapetus', dist: 8.4, period: 79.3, desc: '直径 1469 km，阴阳脸半球 + 赤道脊线——太阳系最奇特的卫星之一。' },
      { id: 'phoebe', name: '土卫九', en: 'Phoebe', dist: 18.8, period: -551, desc: '直径 213 km，逆行公转，可能是被土星捕获的柯伊伯带天体，还是土星环的尘埃来源。' }
    ],
    uranus: [
      { id: 'miranda2', name: '天卫五', en: 'Miranda', dist: 2.4, period: 1.41, desc: '直径 472 km，太阳系地貌最混乱的天体，裂谷、悬崖、平坦地块同时出现，20 km 的维罗纳断崖是太阳系最高悬崖。' },
      { id: 'ariel', name: '天卫一', en: 'Ariel', dist: 2.9, period: 2.52, desc: '直径 1158 km，冰壳上覆盖有纵横裂缝与大规模平原，可能经历过时下的内部熔融事件。' },
      { id: 'umbriel', name: '天卫二', en: 'Umbriel', dist: 3.4, period: 4.14, desc: '直径 1169 km，天王星最黑暗、古老、坑最密集的卫星，表面几乎无地质活动痕迹。' },
      { id: 'titania2', name: '天卫三', en: 'Titania', dist: 3.9, period: 8.7, desc: '直径 1578 km，天王星最大卫星，裂谷、悬崖与撞击坑同时存在，暗示曾有构造与冰火山活动。' },
      { id: 'oberon2', name: '天卫四', en: 'Oberon', dist: 4.7, period: 13.5, desc: '直径 1523 km，天王星最外侧的大卫星，表面覆盖古老陨石坑，坑底有神秘暗色物质。' }
    ],
    neptune: [
      { id: 'naiad', name: '海卫一（涅瑞德）', en: 'Naiad', dist: 1.9, period: 0.29, desc: '海王星最内侧卫星，直径 60 km，像一台“节拍器”一样与外侧卫星保持精确的轨道共振。' },
      { id: 'thalassa', name: '海卫二（萨拉莎）', en: 'Thalassa', dist: 2.0, period: 0.31, desc: '直径 82 km，与 Naiad 和 Despina 共同维持三重轨道共振。' },
      { id: 'despina', name: '海卫三', en: 'Despina', dist: 2.2, period: 0.33, desc: '直径 148 km，紧邻海王星环。' },
      { id: 'galatea', name: '海卫四', en: 'Galatea', dist: 2.4, period: 0.43, desc: '直径 178 km，紧邻海王星最外层亚当斯环，是该环的主要守护者。' },
      { id: 'larissa', name: '海卫五', en: 'Larissa', dist: 2.6, period: 0.55, desc: '直径 194 km，可能正在通过潮汐摩擦力向内迁移。' },
      { id: 'proteus2', name: '海卫八', en: 'Proteus', dist: 3.2, period: 1.12, desc: '直径 420 km，海王星最内侧的大型卫星，几乎没有被锁定成球体——形状不规则，是太阳系最大的形状不规则天体。' },
      { id: 'triton2', name: '海卫一', en: 'Triton', dist: 5.3, period: -5.88, desc: '直径 2707 km，海王星最大卫星，逆行公转，几乎肯定是柯伊伯带被捕获的天体，表面氮气间歇泉不断喷洒入太空。' },
      { id: 'neroid', name: '海卫二（涅瑞伊得）', en: 'Nereid', dist: 14.8, period: 360, desc: '直径 340 km，轨道偏心率高达 0.75，是太阳系轨道最“狂野”的卫星之一。' }
    ],
    pluto: [
      { id: 'charon2', name: '冥卫一', en: 'Charon', dist: 1.5, period: 6.39, desc: '直径 1212 km，冥王星的“双星伴侶”，与冥王星互相潮汐锁定，共同绕质心旋转，北极有暗红色“摩尔多威帽”。' },
      { id: 'styx', name: '冥卫五', en: 'Styx', dist: 2.2, period: 20.2, desc: '直径仅 16 km，冥王星最内侧的小卫星。' },
      { id: 'nix', name: '冥卫三', en: 'Nix', dist: 2.7, period: 24.9, desc: '直径约 50 km，呈拉长的椭球形，红橙色。' },
      { id: 'kerberos', name: '冥卫四', en: 'Kerberos', dist: 3.1, period: 32.1, desc: '直径 12 km，冥王星卫星中最小的一颗。' },
      { id: 'hydra', name: '冥卫二', en: 'Hydra', dist: 3.8, period: 38.2, desc: '直径 46 km，冥王星五颗小卫星中最远的一颗。' }
    ]
  };

  /* ---------- 深空天体分类表（main.js 用） ---------- */
  var DEEP_CATS = {
    '恒星': ['sirius', 'canopus', 'arcturus', 'vega', 'betelgeuse', 'rigel', 'antares', 'polaris', 'alphacen'],
    '致密天体': ['crab', 'psr1919', 'magnetar', 'cygx1', 'sgra', 'm87'],
    '星云与遗迹': ['orion', 'pillars'],
    '恒星系统': ['trappist']
  };

  return {
    THEMES: THEMES, QUALITY: QUALITY,
    SOLAR: SOLAR, EXTRA_MOONS: EXTRA_MOONS, SATELLITES: SATELLITES,
    DEEP: DEEP, DEEP_CATS: DEEP_CATS,
    ABOUT: ABOUT, DISCLAIMER: DISCLAIMER
  };
})();
