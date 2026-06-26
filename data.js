// ============================================================
// data.js  -- 数据层 / 持久化 / 实体查找
// ============================================================

const STORAGE_KEY = 'industry_tracker_v1';

function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getDefaultData() {
  const d = {
    version: 1,
    activeProjectId: 'p-ai',
    timelineDates: [
      '2026-01-15', '2026-02-15', '2026-03-10',
      '2026-04-05', '2026-05-20', '2026-06-25',
    ],
    timelineMeta: {
      '2026-01-15': { label: '台积电 3nm 满载',         note: '2026 资本开支上调至 44B USD，3nm 产能利用率 100%。' },
      '2026-02-15': { label: '英伟达 GTC',               note: 'B300 发布，性能 +50%，功耗 +30%，8 月开始出货。' },
      '2026-03-10': { label: 'SK 海力士 HBM4 良率',     note: '良率突破 70%，ASP 小幅上涨。' },
      '2026-04-05': { label: '国产替代加码',            note: '寒武纪、海光订单超预期，国内大客户切换加速。' },
      '2026-05-20': { label: 'GPT-6 发布 + 台积电 Q1', note: 'GPT-6 多模态大幅提升，推理成本 -70%。台积电 Q1 +35%。' },
      '2026-06-25': { label: 'CFS 聚变 Q>2 + Groq LPU', note: 'CFS 净能量增益 >2，商用化提前到 2030；Groq LPU 冲击推理市场。' },
    },
    activeDate: '2026-06-25',
    projects: [
      {
        id: 'p-ai',
        name: 'AI 算力革命',
        emoji: '🧠',
        color: '#58a6ff',
        description: '跟踪全球 AI 算力 / 软件应用 / 电力能源全产业链关键节点与个股投资机会。',
        createdAt: '2026-01-15',
        sectors: [
          {
            id: 's-chip',
            name: 'AI 芯片与算力',
            icon: '🧠',
            color: '#58a6ff',
            description: 'GPU / ASIC / HBM / 晶圆代工 / 封装 / PCB / 服务器 / 电力',
            trackingEntries: [
              { id: 'tse-chip-1', date: '2026-02-15', content: '【整体】英伟达 GTC 后整条 AI 算力链强势反弹，HBM/封装/服务器全线跟涨。' },
              { id: 'tse-chip-2', date: '2026-04-05', content: '【整体】国产替代政策落地，算力链国产化进入加速期，关注 GPU/HBM/封测三个细分。' },
              { id: 'tse-chip-3', date: '2026-06-25', content: '【整体】推理需求首次超越训练，CFS 聚变 + Groq LPU 改变电力与推理算力格局。' },
            ],
            chainNodes: [
              { id: 'cn-design', label: '芯片设计', x: 8,  y: 50, color: '#58a6ff', icon: '🧩' },
              { id: 'cn-hbm',    label: 'HBM / 存储', x: 22, y: 50, color: '#a371f7', icon: '💾' },
              { id: 'cn-fab',    label: '晶圆代工', x: 36, y: 50, color: '#3fb950', icon: '🏭' },
              { id: 'cn-pack',   label: '先进封装', x: 50, y: 50, color: '#d29922', icon: '📦' },
              { id: 'cn-pcb',    label: 'PCB / 基板', x: 64, y: 50, color: '#f85149', icon: '🧷' },
              { id: 'cn-server', label: '服务器 / 整机', x: 78, y: 50, color: '#ff7b72', icon: '🖥️' },
              { id: 'cn-power',  label: '电力 / 电源', x: 92, y: 50, color: '#7ee787', icon: '⚡' },
            ],
            subdivisions: [
              {
                id: 'sd-gpu',
                name: 'GPU / AI 芯片设计',
                chainNodeId: 'cn-design',
                color: '#58a6ff',
                icon: '🎮',
                trackingEntries: [
                  { id: 'te-g1', date: '2026-02-15', content: '英伟达 GTC 发布 B300，性能 +50%，功耗 +30%，8 月开始出货。' },
                  { id: 'te-g2', date: '2026-03-10', content: 'AMD MI400 推迟到 Q4，市场份额压力增大；股价单日跌 8%。' },
                  { id: 'te-g3', date: '2026-04-05', content: '国产替代政策加码，寒武纪、海光订单超预期，国内大客户切换加速。' },
                  { id: 'te-g4', date: '2026-06-25', content: 'Groq 推出 LPU 推理芯片，每瓦性能 10x GPU，引发推理市场格局重估。' },
                ],
                stocks: [
                  {
                    id: 'st-nvda',
                    name: '英伟达',
                    ticker: 'NVDA',
                    market: '美股',
                    concept: '全球 AI GPU 绝对龙头 / CUDA 生态壁垒',
                    snapshots: [
                      { date: '2026-02-15', price: 920,  marketCap: '3.2T USD',
                        valuation: { pe: 65, peg: 1.8, pb: 28, ps: 22 },
                        mainBusiness: '数据中心 GPU / AI 加速卡 / 边缘计算 / CUDA 软件栈',
                        revenue: 'FY26 Q1 数据中心 28B USD，同比 +210%',
                        grossMargin: '78%',
                        catalysts: 'B300 发布 / Blackwell Ultra 出货 / GB300 路线图' },
                      { date: '2026-04-05', price: 1050, marketCap: '3.8T USD',
                        valuation: { pe: 58, peg: 1.5, pb: 25, ps: 19 },
                        mainBusiness: '数据中心 GPU / AI 加速卡 / 边缘计算 / CUDA 软件栈',
                        revenue: 'FY26 Q2 数据中心 32B USD，同比 +180%',
                        grossMargin: '79%',
                        catalysts: 'B300 量产出货 / GB300 2027 路线图 / 网络业务 NVL' },
                      { date: '2026-06-25', price: 1180, marketCap: '4.1T USD',
                        valuation: { pe: 52, peg: 1.3, pb: 22, ps: 17 },
                        mainBusiness: '数据中心 GPU / AI 加速卡 / 边缘计算 / CUDA / 网络',
                        revenue: 'FY26 Q3 数据中心 36B USD，同比 +165%',
                        grossMargin: '80%',
                        catalysts: 'GB300 出货 / 推理市场 LPU 竞争 / 中东订单' },
                    ],
                    operations: [
                      { id: 'op-nvda-1', date: '2026-02-15', type: 'buy', price: 920,  target: 1200, stopLoss: 820,  position: '建仓 20%', suggestion: '业绩超预期，估值偏高但成长性强。分批建仓，回调 850 加仓。长期看好 AI 算力需求。' },
                      { id: 'op-nvda-2', date: '2026-04-05', type: 'add', price: 1050, target: 1300, stopLoss: 950,  position: '加仓至 35%', suggestion: 'B300 量产出货 + 订单可见度延长到 2027，加仓。' },
                      { id: 'op-nvda-3', date: '2026-06-25', type: 'trim', price: 1180, target: 1400, stopLoss: 1050, position: '减仓 10%', suggestion: '估值进入历史 70 分位，部分获利了结。剩余仓位继续持有至 GB300 量产。' },
                    ],
                  },
                  {
                    id: 'st-amd',
                    name: 'AMD',
                    ticker: 'AMD',
                    market: '美股',
                    concept: 'GPU 第二梯队 + 服务器 CPU 龙头',
                    snapshots: [
                      { date: '2026-02-15', price: 180, marketCap: '290B USD',
                        valuation: { pe: 45, peg: 1.2, pb: 5, ps: 8 },
                        mainBusiness: '数据中心 GPU / 服务器 CPU / 嵌入式 / 客户端',
                        revenue: 'Q4 数据中心 4.2B USD，同比 +90%',
                        grossMargin: '55%',
                        catalysts: 'MI400 发布 / 服务器份额提升 / Helios 机架' },
                      { date: '2026-06-25', price: 165, marketCap: '268B USD',
                        valuation: { pe: 38, peg: 1.1, pb: 4, ps: 7 },
                        mainBusiness: '数据中心 GPU / 服务器 CPU / 嵌入式 / 客户端',
                        revenue: 'Q2 数据中心 5.8B USD，同比 +75%',
                        grossMargin: '54%',
                        catalysts: 'MI400 量产推迟到 Q4 / OpenAI 订单 / Helios' },
                    ],
                    operations: [
                      { id: 'op-amd-1', date: '2026-02-15', type: 'watch', price: 180, target: 220, stopLoss: 155, position: '观察', suggestion: 'MI400 推迟到 Q4，订单不及预期。暂不建仓，等催化剂兑现。' },
                      { id: 'op-amd-2', date: '2026-06-25', type: 'sell', price: 165, target: 200, stopLoss: 145, position: '减持 50%', suggestion: 'MI400 量产推迟 + GPU 份额被 NV 侵蚀。保留底仓博 OpenAI 订单。' },
                    ],
                  },
                  {
                    id: 'st-cambricon',
                    name: '寒武纪',
                    ticker: '688256.SH',
                    market: '科创板',
                    concept: '国产 AI 芯片龙头',
                    snapshots: [
                      { date: '2026-04-05', price: 580, marketCap: '242B CNY',
                        valuation: { pe: 320, peg: 2.5, pb: 18, ps: 90 },
                        mainBusiness: '云端 AI 芯片 / 边缘 AI 芯片 / 加速卡',
                        revenue: 'Q1 营收 4.2B CNY，同比 +450%',
                        grossMargin: '60%',
                        catalysts: '思元 590 量产 / 大客户订单兑现 / 国产替代' },
                      { date: '2026-06-25', price: 720, marketCap: '300B CNY',
                        valuation: { pe: 240, peg: 1.9, pb: 22, ps: 70 },
                        mainBusiness: '云端 AI 芯片 / 边缘 AI 芯片 / 加速卡',
                        revenue: 'Q2 营收 6.1B CNY，同比 +380%',
                        grossMargin: '62%',
                        catalysts: '思元 690 路线图 / 国资订单 / 推理卡出货' },
                    ],
                    operations: [
                      { id: 'op-cam-1', date: '2026-04-05', type: 'speculative', price: 580, target: 750, stopLoss: 480, position: '小仓位 5%', suggestion: '国产替代 + 业绩拐点双重逻辑，但估值极贵，小仓位博弈。' },
                      { id: 'op-cam-2', date: '2026-06-25', type: 'add', price: 720, target: 900, stopLoss: 620, position: '加仓至 10%', suggestion: '业绩持续超预期，订单可见度到 2027Q1，加仓。' },
                    ],
                  },
                ],
              },
              {
                id: 'sd-hbm',
                name: 'HBM 高带宽存储',
                chainNodeId: 'cn-hbm',
                color: '#a371f7',
                icon: '🧠',
                trackingEntries: [
                  { id: 'te-h1', date: '2026-03-10', content: 'SK 海力士 HBM4 良率突破 70%，ASP 小幅上涨。' },
                  { id: 'te-h2', date: '2026-05-20', content: '美光宣布 HBM3E 12-Hi 量产，2026 底扩产 50%。' },
                ],
                stocks: [
                  {
                    id: 'st-skh',
                    name: 'SK 海力士',
                    ticker: '000660.KS',
                    market: '韩股',
                    concept: 'HBM 全球龙头',
                    snapshots: [
                      { date: '2026-03-10', price: 220000, marketCap: '160T KRW',
                        valuation: { pe: 18, peg: 0.9, pb: 3, ps: 4 },
                        mainBusiness: 'DRAM / NAND / HBM',
                        revenue: 'Q1 HBM 收入 5.2T KRW，同比 +250%',
                        grossMargin: '45%',
                        catalysts: 'HBM4 量产 / NVIDIA 长期订单' },
                      { date: '2026-06-25', price: 285000, marketCap: '208T KRW',
                        valuation: { pe: 14, peg: 0.7, pb: 3.5, ps: 5 },
                        mainBusiness: 'DRAM / NAND / HBM',
                        revenue: 'Q2 HBM 收入 7.8T KRW，同比 +320%',
                        grossMargin: '50%',
                        catalysts: 'HBM4 良率 / 长期订单 / NAND 价格反弹' },
                    ],
                    operations: [
                      { id: 'op-skh-1', date: '2026-03-10', type: 'buy', price: 220000, target: 280000, stopLoss: 195000, position: '建仓 15%', suggestion: 'HBM 龙头地位稳固 + 估值合理 (PE 18)，分批建仓。' },
                      { id: 'op-skh-2', date: '2026-06-25', type: 'add', price: 285000, target: 350000, stopLoss: 255000, position: '加仓至 25%', suggestion: 'HBM 占比 + 业绩弹性兑现，加仓。' },
                    ],
                  },
                ],
              },
              {
                id: 'sd-fab',
                name: '晶圆代工',
                chainNodeId: 'cn-fab',
                color: '#3fb950',
                icon: '🏭',
                trackingEntries: [
                  { id: 'te-f1', date: '2026-01-15', content: '台积电 3nm 产能利用率满载，2026 资本开支上调至 44B USD。' },
                  { id: 'te-f2', date: '2026-05-20', content: '台积电美国亚利桑那 Fab 2 量产推迟到 2028。' },
                ],
                stocks: [
                  {
                    id: 'st-tsm',
                    name: '台积电',
                    ticker: 'TSM',
                    market: '美股 ADR',
                    concept: '全球晶圆代工龙头',
                    snapshots: [
                      { date: '2026-01-15', price: 195, marketCap: '1.0T USD',
                        valuation: { pe: 25, peg: 1.4, pb: 6, ps: 9 },
                        mainBusiness: '晶圆代工 / 先进制程 / 先进封装',
                        revenue: 'Q4 营收 26.9B USD，同比 +37%',
                        grossMargin: '62%',
                        catalysts: '3nm/2nm 产能爬坡 / AI 需求 / CoWoS' },
                      { date: '2026-05-20', price: 215, marketCap: '1.1T USD',
                        valuation: { pe: 27, peg: 1.5, pb: 7, ps: 10 },
                        mainBusiness: '晶圆代工 / 先进制程 / 先进封装',
                        revenue: 'Q1 营收 28.4B USD，同比 +35%',
                        grossMargin: '63%',
                        catalysts: '2nm 试产 / CoWoS 扩产 / 亚利桑那推迟' },
                    ],
                    operations: [
                      { id: 'op-tsm-1', date: '2026-01-15', type: 'hold', price: 195, target: 230, stopLoss: 175, position: '持有 10%', suggestion: '估值合理，长期持有，享受 AI 算力红利。' },
                      { id: 'op-tsm-2', date: '2026-05-20', type: 'add', price: 215, target: 250, stopLoss: 195, position: '加仓至 15%', suggestion: '2nm 试产 + CoWoS 满产，景气度延续。' },
                    ],
                  },
                ],
              },
              {
                id: 'sd-pack',
                name: '先进封装 CoWoS',
                chainNodeId: 'cn-pack',
                color: '#d29922',
                icon: '📦',
                trackingEntries: [
                  { id: 'te-p1', date: '2026-04-05', content: 'CoWoS 产能紧缺持续，台积电宣布 2026 扩产 60%。' },
                ],
                stocks: [],
              },
            ],
          },
          {
            id: 's-app',
            name: 'AI 软件应用',
            icon: '🤖',
            color: '#a371f7',
            description: '基础大模型 / MLOps / 行业应用',
            trackingEntries: [
              { id: 'tse-app-1', date: '2026-05-20', content: '【整体】GPT-6 发布后企业 AI 商业化加速，CSP 厂商资本开支预期上修。' },
            ],
            chainNodes: [
              { id: 'cn-model',  label: '基础大模型', x: 25, y: 50, color: '#58a6ff', icon: '🤖' },
              { id: 'cn-mlops',  label: 'MLOps / 平台', x: 50, y: 50, color: '#a371f7', icon: '🛠️' },
              { id: 'cn-vert',   label: '垂直行业应用', x: 75, y: 50, color: '#3fb950', icon: '🎯' },
            ],
            subdivisions: [
              {
                id: 'sd-model',
                name: '基础大模型',
                chainNodeId: 'cn-model',
                color: '#58a6ff',
                icon: '🧠',
                trackingEntries: [
                  { id: 'te-m1', date: '2026-05-20', content: 'GPT-6 发布，多模态能力大幅提升，推理成本下降 70%。' },
                  { id: 'te-m2', date: '2026-06-25', content: 'Claude 4 Opus 在 SWE-bench 编程基准首次超越人类。' },
                ],
                stocks: [
                  {
                    id: 'st-msft',
                    name: '微软',
                    ticker: 'MSFT',
                    market: '美股',
                    concept: 'OpenAI 母公司 + Copilot 生态',
                    snapshots: [
                      { date: '2026-05-20', price: 480, marketCap: '3.6T USD',
                        valuation: { pe: 38, peg: 2.1, pb: 12, ps: 14 },
                        mainBusiness: 'Azure 云 / Office / Windows / GitHub Copilot',
                        revenue: 'Q3 Azure +34%，Copilot ARR 突破 15B USD',
                        grossMargin: '70%',
                        catalysts: 'GPT-6 集成 / 企业 AI 渗透 / Copilot 涨价' },
                    ],
                    operations: [
                      { id: 'op-msft-1', date: '2026-05-20', type: 'hold', price: 480, target: 550, stopLoss: 440, position: '持有 25%', suggestion: 'AI 商业化领先，长期持有。' },
                    ],
                  },
                  {
                    id: 'st-googl',
                    name: 'Alphabet',
                    ticker: 'GOOGL',
                    market: '美股',
                    concept: 'Gemini / 搜索 AI / Cloud',
                    snapshots: [
                      { date: '2026-05-20', price: 198, marketCap: '2.4T USD',
                        valuation: { pe: 24, peg: 1.4, pb: 7, ps: 7 },
                        mainBusiness: '搜索 / 广告 / Cloud / YouTube / Waymo / Gemini',
                        revenue: 'Q1 Cloud +28%，Gemini API 调用 +400%',
                        grossMargin: '58%',
                        catalysts: 'Gemini 3 / 搜索 AI 化 / Cloud 加速' },
                    ],
                    operations: [
                      { id: 'op-googl-1', date: '2026-05-20', type: 'buy', price: 198, target: 240, stopLoss: 175, position: '建仓 10%', suggestion: '估值合理 + Gemini 商业化加速 + Cloud 二阶导。' },
                    ],
                  },
                ],
              },
              {
                id: 'sd-vert',
                name: '垂直行业 AI 应用',
                chainNodeId: 'cn-vert',
                color: '#3fb950',
                icon: '🎯',
                trackingEntries: [
                  { id: 'te-v1', date: '2026-06-25', content: '法律 AI Harvey ARR 突破 100M，估值 5B。' },
                ],
                stocks: [],
              },
            ],
          },
          {
            id: 's-power',
            name: 'AI 电力与能源',
            icon: '⚡',
            color: '#d29922',
            description: '发电 / 电网 / 储能',
            trackingEntries: [
              { id: 'tse-power-1', date: '2026-06-25', content: '【整体】聚变商业化时间表提前到 2030，长线电力主题重估。' },
            ],
            chainNodes: [
              { id: 'cn-gen',   label: '发电 (核电/光伏)', x: 20, y: 50, color: '#58a6ff', icon: '☀️' },
              { id: 'cn-grid',  label: '电网 / 特高压',   x: 50, y: 50, color: '#a371f7', icon: '🔌' },
              { id: 'cn-store', label: '储能 / 电池',     x: 80, y: 50, color: '#3fb950', icon: '🔋' },
            ],
            subdivisions: [
              {
                id: 'sd-nuclear',
                name: '核电与可控核聚变',
                chainNodeId: 'cn-gen',
                color: '#58a6ff',
                icon: '☢️',
                trackingEntries: [
                  { id: 'te-n1', date: '2026-06-25', content: 'CFS 宣布 SPARC 聚变实验堆净能量增益 Q>2，商用化时间表提前到 2030。' },
                ],
                stocks: [
                  {
                    id: 'st-cfs',
                    name: 'Commonwealth Fusion',
                    ticker: 'CFS',
                    market: '私募',
                    concept: 'MIT 衍生 / 托卡马克聚变 / 高温超导',
                    snapshots: [
                      { date: '2026-06-25', price: null, marketCap: '估值 8B USD',
                        valuation: { pe: null, peg: null, pb: null, ps: null },
                        mainBusiness: '高温超导磁体 / 紧凑型聚变反应堆',
                        revenue: '未商业化',
                        grossMargin: 'N/A',
                        catalysts: 'SPARC 实验堆 2027 / 商业化路径 / 长期订单' },
                    ],
                    operations: [
                      { id: 'op-cfs-1', date: '2026-06-25', type: 'watch', price: null, target: null, stopLoss: null, position: '观察', suggestion: '前沿技术，估值高且未商业化，仅作为概念跟踪。' },
                    ],
                  },
                ],
              },
              {
                id: 'sd-grid',
                name: '电网与特高压',
                chainNodeId: 'cn-grid',
                color: '#a371f7',
                icon: '🔌',
                trackingEntries: [],
                stocks: [],
              },
            ],
          },
        ],
      },
    ],
  };
  // 为所有快照/操作/跟踪条目补 id
  for (const p of d.projects) for (const sec of p.sectors) {
    if (!sec.trackingEntries) sec.trackingEntries = [];
    for (const sd of sec.subdivisions) {
    for (const st of (sd.stocks || [])) {
      for (const s of (st.snapshots || [])) { if (!s.id) s.id = uid("sn-"); }
      for (const o of (st.operations || [])) { if (!o.id) o.id = uid("op-"); }
    }
    for (const t of (sd.trackingEntries || [])) { if (!t.id) t.id = uid("te-"); }
    }
  }
  return d;
}

// ---------- 持久化 ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultData();
      saveData(initial);
      return initial;
    }
    const data = JSON.parse(raw);
    if (!data.version) data.version = 1;
    if (!data.timelineDates) data.timelineDates = [];
    if (!data.timelineMeta)  data.timelineMeta = {};
    if (!data.projects) data.projects = [];
    // 向后兼容：为缺失 id 的快照补 id（避免删除失效）
    for (const p of data.projects) for (const sec of p.sectors) {
      if (!sec.trackingEntries) sec.trackingEntries = [];
      if (!sec.icon) sec.icon = (sec.chainNodes && sec.chainNodes[0] && sec.chainNodes[0].icon) || '📁';
      if (!sec.color) sec.color = (sec.chainNodes && sec.chainNodes[0] && sec.chainNodes[0].color) || '#58a6ff';
      for (const t of (sec.trackingEntries || [])) { if (!t.id) t.id = uid("te-"); }
      for (const sd of sec.subdivisions) {
      for (const st of (sd.stocks || [])) {
        for (const s of (st.snapshots || [])) { if (!s.id) s.id = uid("sn-"); }
        for (const o of (st.operations || [])) { if (!o.id) o.id = uid("op-"); }
      }
      for (const t of (sd.trackingEntries || [])) { if (!t.id) t.id = uid("te-"); }
    }
    }
    return data;
  } catch (e) {
    console.error('加载数据失败，重置', e);
    const initial = getDefaultData();
    saveData(initial);
    return initial;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('保存数据失败', e);
    alert('数据保存失败：' + e.message);
  }
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  return loadData();
}

// ---------- 实体查找 ----------
function findProject(data, id)        { return data.projects.find(p => p.id === id); }
function findSector(project, id)      { return project && project.sectors.find(s => s.id === id); }
function findSubdivision(sec, id)     { return sec && sec.subdivisions.find(sd => sd.id === id); }
function findStock(sd, id)            { return sd && sd.stocks.find(st => st.id === id); }
function findOperation(stock, id)     { return stock && stock.operations.find(o => o.id === id); }
function findChainNode(sec, id)       { return sec && sec.chainNodes.find(n => n.id === id); }

// ---------- 顶层工具 ----------
function opTypeMeta(type) {
  return ({
    buy:         { label: '建仓', color: '#3fb950', icon: '🟢' },
    add:         { label: '加仓', color: '#3fb950', icon: '➕' },
    hold:        { label: '持有', color: '#58a6ff', icon: '🟦' },
    trim:        { label: '减仓', color: '#d29922', icon: '✂️' },
    sell:        { label: '清仓', color: '#f85149', icon: '🔴' },
    watch:       { label: '观察', color: '#7d8590', icon: '👀' },
    speculative: { label: '博弈', color: '#a371f7', icon: '🎲' },
  })[type] || { label: type, color: '#7d8590', icon: '·' };
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString();
  return v;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function sortedSnapshots(stock) {
  return [...(stock.snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
}
function latestSnapshotBefore(stock, date) {
  const arr = sortedSnapshots(stock);
  return [...arr].reverse().find(s => s.date <= date) || null;
}
function latestOperationBefore(stock, date) {
  const arr = [...(stock.operations || [])].sort((a, b) => a.date.localeCompare(b.date));
  return [...arr].reverse().find(o => o.date <= date) || null;
}

window.ST = {
  STORAGE_KEY, uid, todayISO,
  getDefaultData, loadData, saveData, resetData,
  findProject, findSector, findSubdivision, findStock, findOperation, findChainNode,
  opTypeMeta, fmtDate, fmtNum, escapeHtml,
  sortedSnapshots, latestSnapshotBefore, latestOperationBefore,
  getTimelineMeta, setTimelineMeta,
  EMOJI_PRESETS: ['🧠','🎮','💾','🏭','📦','🔌','⚡','🤖','🛠️','🎯','☀️','☢️','🎲','📊','📈','📉','💰','🚀','🔥','✨','🔋','💎','📱','🖥️','🧬','🧪','🛰️','🔭','📡','🪐','💫','🌐'],
};



// ---------- 时间节点元数据 ----------
function getTimelineMeta(data, date) {
  return (data.timelineMeta && data.timelineMeta[date]) || { label: '', note: '' };
}
function setTimelineMeta(data, date, meta) {
  data.timelineMeta = data.timelineMeta || {};
  if (!meta || (!meta.label && !meta.note)) {
    delete data.timelineMeta[date];
  } else {
    data.timelineMeta[date] = { label: meta.label || '', note: meta.note || '' };
  }
}

