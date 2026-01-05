# 🛰️ Node: The Bottleneck Radar
> **"대체 어디서 막힌 거야?"** — 이제 이 질문은 그만하셔도 됩니다.

**Node**는 단순한 '할 일 목록(To-Do List)'이 아닙니다.  
프로젝트의 **흐름(Flow)**을 시각화하고, 병목 구간을 즉시 찾아내는 **그래프 기반 협업 도구**입니다.

---

## 🌟 1. 왜 Node인가요? (Why Project)

전통적인 리스트 방식의 툴(Jira, Asana, Notion 등)은 **"순서"**를 보여주지 못합니다.  
A가 끝나야 B를 할 수 있는데, 리스트에는 그냥 둘 다 "진행 중"으로만 보이죠.

Node는 프로젝트를 **방향성 있는 그래프(DAG)**로 모델링합니다.  
누가 누구를 기다리고 있는지, **"진짜 문제"**가 무엇인지 한눈에 보여줍니다.

---

## 🔥 2. 핵심 기능 소개 (Key Features)

### 🕸️ 1. Dynamic Graph View (살아있는 지도)
텍스트가 아닌 **지도(Map)**로 프로젝트를 보세요.
- **시각적 의존성**: 태스크 간의 관계를 화살표(`DEPENDS_ON`)로 연결합니다.
- **Auto-Layout**: 복잡한 관계도 깔끔하게, 자동으로 정리되어 보입니다.

### ⚡ 2. Auto-Derivation Status (상태 자동 추론)
상태를 수동으로 바꿀 필요가 없습니다. 시스템이 알아서 계산합니다.
- **🔴 BLOCKED (차단됨)**: 선행 작업이 안 끝났나요? 그럼 당신은 자동으로 '차단' 상태입니다.
- **🟡 WAITING (대기 중)**: 누군가의 승인을 기다리나요? 시스템이 '대기'로 표시합니다.
- **🟢 NOW (지금 할 일)**: 모든 선행 조건이 해결된, **당장 시작할 수 있는 일**만 모아서 보여줍니다.

### 🎯 3. Request Protocol (공식 요청 프로세스)
"어? 말한 줄 알았는데..." 같은 소통 미스를 100% 차단합니다.
- **Ask → Respond → Approve**: 공식적인 요청과 승인 절차를 통해 책임을 명확히 합니다.
- **Audit Log**: 누가 언제 무엇을 승인했는지 모두 기록됩니다.

---

## 🤖 3. AI 활용 (Secret Weapon)

Node는 **OpenAI GPT-4o**를 활용하여 프로젝트의 막힌 혈을 뚫어줍니다.

### 🧠 Intelligent Block Analysis (지능형 차단 분석)
일이 안 풀릴 때 **"Why am I blocked?"** 버튼을 누르세요.
- AI가 그래프의 상류(Up-stream)를 역추적 대조 분석합니다.
- **"현재 디자인 팀의 승인이 3일째 지연되어 개발이 막혀있습니다."** 처럼 정확한 원인을 짚어줍니다.
- 해결을 위해 **누구에게 연락해야 하는지** 콕 집어 알려줍니다.

### ✍️ Auto-Draft Requests (자동 요청 작성)
동료나 상사에게 재촉하기 껄끄러우신가요?
- AI가 정중하지만 확실한 **요청 메시지(Request Message)**를 대신 써줍니다.
- 상황(차단 원인, 급박함)을 문맥에 맞게 반영하여, 버튼 한 번으로 보낼 수 있습니다.

---

## 🛠️ 4. 기술 스택 (Tech Stack)
최신 기술로 무장하여 빠르고 안정적입니다.
- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Supabase) + Prisma 7
- **Interactive Engine**: React Flow + TanStack Query
- **Design System**: TailwindCSS + Shadcn/ui

---

### 🚀 지금 시작하세요
복잡한 의존성 지옥에서 탈출하고, **진짜 몰입(Flow)**을 경험하세요.
**Node: Unblock Your Potential.**
