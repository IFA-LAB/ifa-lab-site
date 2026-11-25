"""One-off seed: migrate member data from the old Google Site into src/data/members/*.json.
Run once with `python -I scripts/seed-members.py`; afterwards edit the JSON (or Keystatic), not this script."""
import json, os

D = os.path.join(os.path.dirname(__file__), "..", "src", "data", "members")


def L(zh, en=None):
    d = {"zh": zh}
    if en:
        d["en"] = en
    return d


NCU_IM = L("國立中央大學 資訊管理學系", "National Central University, Information Management")
M = {}

M["yun-cheng-chiang"] = dict(
    name=L("江昀澄", "Yun-Cheng Chiang"), cohort=1, order=1, degree="master", status="graduated", founder=True, maintainedBy="lab",
    headline=L("資管所碩士・113 學年度畢業", "M.S. in Information Management, 2025"),
    bio=L("中央資管碩士，研究可解釋 AI（XAI）在股票報酬預測上的應用，碩士論文以 SHAP-IQ 分析股票特徵之間的交互效果。熟悉 Python、C、Java、SQL 與 JavaScript，曾維護中山大學學務處網站後端，並擔任中央資管財務課程助教。",
          "Master's graduate of NCU Information Management. His research applies explainable AI (XAI) to stock return prediction; his thesis uses SHAP-IQ to measure interaction effects between stock characteristics. Skilled in Python, C, Java, SQL and JavaScript, he previously maintained the backend of NSYSU's Office of Student Affairs website and was a teaching assistant for finance courses at NCU."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="2023–2025"),
               dict(school=L("國立中山大學 資訊管理學系", "National Sun Yat-sen University, Information Management"), degree=L("學士", "B.S."), period="2019–2023")],
    awards=[L("2024 GenAI Stars 優選：Chad.AI 企業金融 AO 助手", "2024 GenAI Stars Merit Award: Chad.AI corporate-finance AO assistant"),
            L("2022 科技部大專學生研究計畫", "2022 MOST College Student Research Project"),
            L("科技部計畫助理：風格投資人關注程度、事件情緒及風格聯動性", "MOST project assistant: style-based investor attention, event sentiment and style comovement")],
    research=["AI & Machine Learning", "Data Science & Fintech", "Big Data Analytics", "Explainable AI (XAI)"],
    interests=[L("足球", "Soccer"), L("音樂", "Music"), L("貓", "Cats")],
    thesis="chiang-yun-cheng-113", figure=dict(clay="blue", accessory="none"))

M["dao-en-liu"] = dict(
    name=L("劉道恩", "Dao-En Liu"), cohort=1, order=2, degree="master", status="enrolled", founder=True, maintainedBy="lab", placeholder=True,
    headline=L("第一屆研究生", "1st-cohort graduate student"))

M["chia-en-tsai"] = dict(
    name=L("蔡嘉恩", "Chia-En Tsai"), cohort=1, order=3, degree="master", status="graduated", founder=True, maintainedBy="lab",
    headline=L("資管所碩士・113 學年度畢業", "M.S. in Information Management, 2025"),
    bio=L("中央資管碩士，專長 AI 與軟體開發。研究自然語言處理在財務分析的應用，以及用矩陣分解改善推薦系統；碩士論文以基金持股行為序列建立個人投資推薦系統。曾用 C# .NET 與 Angular 開發應用，做過結合 YOLOv4 與 LINE Bot 的燙傷辨識系統，持有 Java SE 8 與 Microsoft AI Fundamentals 證照。",
          "Master's graduate of NCU Information Management, specializing in AI and software development. He studied NLP for financial analysis and matrix factorization for recommender systems; his thesis builds a personal investment recommender from fund holding sequences. He has built apps with C# .NET and Angular, including a burn-assessment system combining YOLOv4 with a LINE Bot, and holds Java SE 8 and Microsoft AI Fundamentals certifications."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="2023–2025"),
               dict(school=L("輔仁大學 資訊管理學系", "Fu Jen Catholic University, Information Management"), degree=L("學士", "B.S."), period="2020–2023")],
    projects=[dict(name="Burn Finder", year="2022", desc=L("結合 YOLOv4 與 LINE Bot 的燙傷程度辨識系統", "Burn-severity recognition with YOLOv4 and a LINE Bot")),
              dict(name="POS System", year="2022", desc=L("以設計模式實作的銷售點系統", "Point-of-sale system built with design patterns"))],
    awards=[L("2024 GenAI Stars 優選：Chad.AI", "2024 GenAI Stars Merit Award: Chad.AI"),
            L("2022 全國企業管理競賽 亞軍（CANCER FINDING）", "2022 National Business Management Competition, runner-up (CANCER FINDING)"),
            L("IMP 2022 研討會發表", "Presented at IMP 2022"),
            L("2022 Technology Innovation and Management 國際研討會發表", "Presented at the 2022 Technology Innovation and Management International Conference")],
    research=["AI & Machine Learning", "FinTech", "HealthTech", "NLP", "Software Development", "Cloud & Containers"],
    interests=[L("吉他", "Guitar"), L("運動", "Sports"), L("電玩", "Video games")],
    thesis="tsai-chia-en-113", figure=dict(clay="down", accessory="guitar"))

M["zi-wei-xie"] = dict(
    name=L("謝子尉", "Zi-Wei Xie"), cohort=2, order=1, degree="master", status="graduated", founder=True, maintainedBy="lab",
    headline=L("資管所碩士・114 學年度畢業", "M.S. in Information Management, 2026"),
    bio=L("中央資管學士、碩士，專長時空網路（Spatio-Temporal Network）、LangChain Agent、FastAPI 與 Flask。碩士論文提出 SeqTAG，用條件式格蘭傑因果圖與圖卷積建構台灣股市投資組合。曾在台積電、工研院實習，也擔任統計與 Python 課程助教。",
          "B.S. and M.S. in Information Management at NCU, working on spatio-temporal networks, LangChain agents, FastAPI and Flask. His thesis proposes SeqTAG, which builds Taiwan equity portfolios from conditional Granger causality graphs and graph convolution. He interned at TSMC and ITRI and taught as a statistics and Python TA."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="2024–2026"), dict(school=NCU_IM, degree=L("學士", "B.S."), period="2020–2024")],
    experience=[dict(title=L("研究助理", "Research Assistant"), org=L("IFA Lab", "IFA Lab"), period="2023/09–"),
                dict(title=L("實習生", "Intern"), org=L("台積電", "TSMC"), period="2025/07–2025/09"),
                dict(title=L("實習生", "Intern"), org=L("工業技術研究院", "ITRI"), period="2023/07–2023/09"),
                dict(title=L("網站維護", "Website Maintenance"), org=L("中央大學秘書室", "NCU Secretariat"), period="2024/02–2024/08"),
                dict(title=L("統計學助教", "Statistics TA"), org=NCU_IM, period="2025/02–2025/06"),
                dict(title=L("Python 助教", "Python TA"), org=NCU_IM, period="2023/09–2024/01")],
    research=["LangChain Agent", "Financial Analysis", "Time Series Analysis", "Machine Learning", "Deep Learning"],
    interests=[L("鋼琴", "Piano"), L("健身", "Gym"), L("跑步", "Running")],
    thesis="xie-zi-wei-114", figure=dict(clay="sun", accessory="phones"))

M["yu-chieh-chiang"] = dict(
    name=L("江昱潔", "Yu-Chieh Chiang"), cohort=2, order=2, degree="master", status="graduated", maintainedBy="lab",
    headline=L("資管所碩士・114 學年度畢業", "M.S. in Information Management, 2026"),
    bio=L("中央資管碩士，碩士論文研究共同基金持股序列的「下一籃」推薦，結合 DNNTSP 模型與外部特徵做實證分析。",
          "Master's graduate of NCU Information Management. Her thesis studies next-basket recommendation from mutual fund holding sequences, combining the DNNTSP model with external features."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="–2026")],
    research=["Recommender Systems", "Mutual Funds", "Deep Learning"],
    thesis="chiang-yu-chieh-114", figure=dict(clay="pink", accessory="none"))

M["kai-xiang-chang"] = dict(
    name=L("張凱翔", "Kai-Xiang Chang"), cohort=2, order=3, degree="master", status="graduated", maintainedBy="lab",
    headline=L("資管所碩士・114 學年度畢業", "M.S. in Information Management, 2026"),
    bio=L("中央資管碩士，研究資產定價與機器學習在投資決策、投資組合建構上的應用；碩士論文提出結合多因子架構與高維度序列分析的兩階段混合模型。曾在國網中心實習開發 Kubernetes 教學雲容器，也當過 CloudMile 校園大使、中央大學校務研究辦公室工讀生。",
          "Master's graduate of NCU Information Management, researching asset pricing and machine learning for investment decisions and portfolio construction. His thesis proposes a two-stage hybrid model combining a multi-factor architecture with high-dimensional sequence analysis. He interned at the National Center for High-performance Computing building Kubernetes teaching containers, was a CloudMile campus ambassador, and worked at NCU's Office of Institutional Research."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="2024–2026"),
               dict(school=L("逢甲大學 資訊工程學系", "Feng Chia University, Computer Science"), degree=L("學士", "B.S."), period="2021–2024"),
               dict(school=L("國立臺中科技大學 資訊管理系", "National Taichung University of Science and Technology, Information Management"), degree=L("五專", "Associate degree"), period="2015–2021")],
    experience=[dict(title=L("暑期實習生", "Summer Intern"), org=L("國家高速網路與計算中心", "National Center for High-performance Computing"), period="2022/07–2022/08"),
                dict(title=L("校園大使", "Campus Ambassador"), org=L("CloudMile", "CloudMile"), period="2023/07–2023/08"),
                dict(title=L("工讀生", "Part-time Assistant"), org=L("中央大學校務研究辦公室", "NCU Office of Institutional Research"), period="2024/07–")],
    research=["Asset Pricing", "Data Science", "Machine Learning", "Deep Learning"],
    interests=[L("動畫與電影", "Anime and movies"), L("投資", "Investing"), L("羽球、桌球", "Badminton and table tennis"), L("美食", "Food")],
    thesis="chang-kai-xiang-114",
    links=dict(schoolEmail="kaixiang@g.ncu.edu.tw", github="https://github.com/KaiXiangC", linkedin="https://www.linkedin.com/in/kaixiang-chang"),
    figure=dict(clay="blue", accessory="glasses"))

M["wei-hua-hou"] = dict(
    name=L("侯威華", "Wei-Hua Hou"), cohort=3, order=1, degree="master", status="enrolled", maintainedBy="self",
    headline=L("資管所碩士班", "M.S. student, Information Management"),
    bio=L("中央資管碩士生，專長 AI 模型架構與應用開發。曾與工研院合作處理資料稀少與類別不平衡問題，目前參與兆豐金控產學合作，研究隨機優勢的可預測性與持續性。",
          "M.S. student at NCU Information Management, focused on AI model architecture and application development. He worked with ITRI on data scarcity and class imbalance, and now works on an industry-academia project with Mega Financial Holding on the predictability and persistence of stochastic dominance."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="2025–"),
               dict(school=L("國立雲林科技大學 資訊管理系", "National Yunlin University of Science and Technology, Information Management"), degree=L("學士", "B.S."), period="2021–2025")],
    projects=[dict(name="Stochastic Dominance", year="2025–", desc=L("兆豐金控產學合作：隨機優勢的可預測性與持續性", "Mega Financial Holding: predictability and persistence of stochastic dominance")),
              dict(name="Metal Defect Detection", year="—", desc=L("工研院：金屬表面瑕疵偵測的不平衡資料處理與 AI 模型", "ITRI: imbalanced data handling and AI models for metal surface defect detection")),
              dict(name="AI LINE Bot", year="—", desc=L("聯合通訊：AI LINE Bot 開發", "Allied Communications: AI LINE Bot development")),
              dict(name="Base Running Analysis", year="—", desc=L("長榮大學：AI 跑壘動作分析", "Chang Jung Christian University: AI-based base running motion analysis"))],
    awards=[L("ICIM 2024 最佳論文獎", "Best Paper Award, ICIM 2024"),
            L("IEEE ICKII 2024 最佳論文獎", "Best Paper Award, IEEE ICKII 2024"),
            L("第 6 屆 AIoT 智慧照護競賽 第二名暨企業獎", "2nd place and corporate award, 6th AIoT Smart Care Competition"),
            L("第 4 屆巨量資料精準行銷盃 第二名", "2nd place, 4th Big Data Precision Marketing Cup"),
            L("第 18 屆數位訊號處理創意設計競賽 佳作（AI 應用組）", "Honorable mention, 18th DSP Creative Design Contest (AI applications)"),
            L("第 20 屆校園證券投資理財達人賽 中區第 8 名", "8th place (Central), 20th Campus Securities Investment Contest")],
    research=["Machine Learning", "Deep Learning", "Reinforcement Learning", "Feature Engineering", "Data Mining"],
    interests=[L("跑步", "Running"), L("探索新領域", "Exploring new frontiers")],
    figure=dict(clay="down", accessory="none"))

M["yu-bin-chen"] = dict(
    name=L("陳昱斌", "Yu-Bin Chen"), cohort=3, order=2, degree="master", status="enrolled", maintainedBy="self",
    headline=L("資管所碩士班", "M.S. student, Information Management"),
    bio=L("中央資管碩士生，研究市場微結構與資訊不對稱。做過 Fama–French 因子、隔夜報酬與券商分點交易資料的策略研究，目前參與兆豐銀行產學合作，研究隨機優勢的可預測性與持續性。大學期間做過兩個資安與 AI 專題，受邀到友達光電發表，並有兩年以上程式教學經驗。",
          "M.S. student at NCU Information Management researching market microstructure and information asymmetry. He has studied strategies based on Fama–French factors, overnight returns and broker-branch trading data, and now works on an industry-academia project with Mega International Commercial Bank on the predictability and persistence of stochastic dominance. As an undergraduate he led two security and AI projects, gave an invited talk at AUO, and has taught programming for over two years."),
    education=[dict(school=NCU_IM, degree=L("碩士", "M.S."), period="2025–"),
               dict(school=L("輔仁大學", "Fu Jen Catholic University"), degree=L("學士", "B.S."), period="2022–2025")],
    experience=[dict(title=L("程式講師", "Programming Instructor"), org=L("蘋果芽數位科技", "AppleBud Digital Technology"), period="2023/01–")],
    projects=[dict(name="Software Vulnerability Detection", year="2024–2025", desc=L("電腦軟體弱點偵測系統；受邀於友達光電發表", "Software vulnerability detection system; invited talk at AUO")),
              dict(name="Lunchbox Calorie Detection", year="2023–2024", desc=L("以 YOLOv4 與 Arduino 自動估算便當熱量", "Automatic lunchbox calorie estimation with YOLOv4 and Arduino")),
              dict(name="Mega Bank Project", year="2025–", desc=L("兆豐銀行產學合作：跨時區資料對齊、超參數調整與財務特徵", "Mega Bank: cross-timezone data alignment, tuning and financial features"))],
    awards=[L("2024 大專校院資訊應用服務創新競賽 產學合作組 第一名", "1st place, 2024 InnoServe Awards (industry cooperation)"),
            L("2024 大專校院資訊應用服務創新競賽 資安組 佳作", "Honorable mention, 2024 InnoServe Awards (information security)"),
            L("2024 中國工程師學會競賽 第三名", "3rd place, 2024 Chinese Institute of Engineers competition"),
            L("2023 中華民國作業研究學會學生專題競賽 佳作", "Honorable mention, 2023 ORSTW student project competition")],
    research=["Market Microstructure", "Information Asymmetry", "Order Flow Toxicity", "Broker-Level Trading", "Deep Learning for Time Series"],
    interests=[L("排球、健身", "Volleyball and fitness"), L("MotoGP、F1", "MotoGP and Formula 1"), L("台股與加密貨幣", "Taiwan stocks and crypto"), L("唱歌", "Singing")],
    links=dict(schoolEmail="qwer521463@g.ncu.edu.tw", github="https://github.com/Alvis12"),
    figure=dict(clay="up", accessory="none"))

M["you-ming-xie"] = dict(name=L("謝侑明"), cohort=3, order=3, degree="master", status="enrolled", maintainedBy="self", placeholder=True,
                         headline=L("第三屆研究生", "3rd-cohort graduate student"))

M["ju-shen-huang"] = dict(
    name=L("黃鉅燊", "Ju-Shen Huang"), cohort=4, order=1, degree="bachelor", status="enrolled", founder=True, maintainedBy="self",
    headline=L("資管系學士班・Finctory 技術長", "B.S. student, Information Management · CTO, Finctory"),
    bio=L("中央資管學士班學生，專長資料科學、Python 與 AI。Finctory 技術長，帶領軟體開發；聯合開發者社團（UDC）共同創辦人與講師，2024 中大新生網副執行長。研究方向包含金融科技與精準教育，國科會大專生計畫做結合股市異常指標與生成式 AI 的股票追蹤系統。",
          "B.S. student in Information Management at NCU, working on data science, Python and AI. CTO of Finctory, leading software development; co-founder and instructor of the United Developer Club (UDC) and vice executive of NCU Fresh Web 2024. His research covers fintech and precision education; his NSTC undergraduate project builds a stock tracking system that combines market anomaly indicators with generative AI."),
    education=[dict(school=NCU_IM, degree=L("學士", "B.S."), period="2022–")],
    experience=[dict(title=L("技術長", "Chief Technology Officer"), org=L("Finctory", "Finctory"), period="2024/04–"),
                dict(title=L("研究助理", "Research Assistant"), org=L("IFA Lab", "IFA Lab"), period="2023/11–"),
                dict(title=L("副執行長", "Deputy Leader"), org=L("中大新生網 2024", "NCU Fresh Web 2024"), period="2023/10–2024/12"),
                dict(title=L("網管", "Network Manager"), org=L("中央大學學習與教學研究所", "NCU Graduate Institute of Learning and Instruction"), period="2023/09–2023/12"),
                dict(title=L("副召集人", "Deputy Convener"), org=L("聯合開發者社團", "United Developer Club"), period="2023/09–2023/12"),
                dict(title=L("成員", "Member"), org=L("中央大學 SAP 學生團隊", "NCU SAP Student Team"), period="2022/10–2024/02")],
    projects=[dict(name="Chad.AI", year="2024", desc=L("給授信人員的生成式 AI 助手", "Generative AI assistant for credit underwriters"), url="https://github.com/OG-Matcha/Credit-Report"),
              dict(name="NCU Fresh Web Chat Bot", year="2024", desc=L("中大新生網聊天機器人", "Chat bot for NCU Fresh Web"), url="https://github.com/OG-Matcha/NCU_Fresh_Web_ChatBot"),
              dict(name="Cow of Answer", year="2024", desc=L("問答遊戲", "Q&A game"), url="https://github.com/OG-Matcha/Cow-of-Answer"),
              dict(name="Python Mock Interview", year="2024", desc=L("Python 模擬面試", "Python mock interviews"), url="https://github.com/OG-Matcha/Python_Mock_Interview"),
              dict(name="WuXia", year="2024", desc=L("武俠遊戲", "Wuxia game"), url="https://github.com/OG-Matcha/WuXia"),
              dict(name="BrainLib", year="2024", desc=L("知識管理工具", "Knowledge tool"), url="https://github.com/OG-Matcha/BrainLib")],
    awards=[L("2025 TSMC Campus Hackathon（第 6 屆）AI ops 組 第一名", "1st place, AI Ops track, 2025 TSMC Campus Hackathon (6th)"),
            L("2024 第 29 屆大專校院資訊應用服務創新競賽 資安組 第一名", "1st place, Information Security track, 29th InnoServe Awards (2024)"),
            L("2024 台灣數位創意獎 金獎", "Gold, 2024 Taiwan Digital Creativity Award"),
            L("2024 Startup Arena（第 6 屆）第一名", "1st place, Startup Arena 2024 (6th)"),
            L("LAK25 Practitioner Track：以知識圖譜與大型語言模型追蹤學習軌跡", "LAK25 Practitioner Track: tracking learning trajectories with knowledge graphs and LLMs")],
    research=["Data Science", "Machine Learning", "Deep Learning", "Generative AI", "System Analysis & Design", "Web Engineering"],
    interests=[L("動畫、漫畫", "Anime and manga"), L("電玩", "Video games"), L("VTuber", "VTubers")],
    links=dict(github="https://github.com/OG-Matcha", linkedin="https://www.linkedin.com/in/ogmatcha/", website="https://ogmatcha.com"),
    figure=dict(clay="blue", accessory="phones"))

M["sheng-le-wu"] = dict(name=L("吳聲樂"), cohort=4, order=2, status="enrolled", maintainedBy="self", placeholder=True,
                        headline=L("第四屆", "4th cohort"))
M["hong-jie-zeng"] = dict(name=L("曾紘杰"), cohort=4, order=3, status="enrolled", maintainedBy="self", placeholder=True,
                          headline=L("第四屆", "4th cohort"))

os.makedirs(D, exist_ok=True)
for k, v in M.items():
    with open(os.path.join(D, f"{k}.json"), "w", encoding="utf-8") as f:
        json.dump(v, f, ensure_ascii=False, indent=2)
        f.write("\n")
print(len(M), "members written")
