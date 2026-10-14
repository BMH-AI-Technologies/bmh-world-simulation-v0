# BMH World Simulation v0

**Bản đồ 01 · Phố cổ Hà Nội.** Cả khu phố cổ Hà Nội chạy ngay trong trình duyệt của bạn: hơn 11.000 ngôi nhà thật lấy từ OpenStreetMap, vài trăm người đi bộ và xe máy sống theo nhịp ngày, cùng 12 cư dân có "não" AI tự lên kế hoạch, tám chuyện và phản ứng với mọi thứ xảy ra. Gõ một câu bất kỳ — *"cháy ở Hàng Bạc"*, *"Việt Nam vô địch"*, *"một con trâu xổng chuồng ở chợ Đồng Xuân"* — và cả phố sẽ diễn cho bạn xem.

> 🇬🇧 English guide: [README.en.md](README.en.md)

![Phố cổ lúc chạng vạng](docs/images/hero-blue-hour.jpg)

Đây là một **bàn thử nghiệm mở cho tác tử AI (LLM agents) sống trong thành phố thật**. Bản v0 dựng phố cổ Hà Nội; bạn hoàn toàn có thể fork về, đổi sang thành phố của mình, thêm nhân vật, thêm sự kiện. Không cần máy chủ, không cần tài khoản, mã nguồn mở (MIT).

---

## Mục lục

1. [Có gì bên trong](#1-có-gì-bên-trong)
2. [Chạy thử trong 2 phút](#2-chạy-thử-trong-2-phút)
3. [Thêm khoá AI (và chạy không cần khoá)](#3-thêm-khoá-ai-và-chạy-không-cần-khoá)
4. [Cách dùng](#4-cách-dùng)
5. [Danh mục sự kiện](#5-danh-mục-sự-kiện)
6. [Các cư dân](#6-các-cư-dân)
7. [Nhịp sống phố cổ](#7-nhịp-sống-phố-cổ)
8. [Chi phí](#8-chi-phí)
9. [Bên trong hoạt động thế nào](#9-bên-trong-hoạt-động-thế-nào)
10. [Fork về: đổi sang thành phố của bạn](#10-fork-về-đổi-sang-thành-phố-của-bạn)
11. [Thêm nhân vật mới](#11-thêm-nhân-vật-mới)
12. [Thêm loại sự kiện mới](#12-thêm-loại-sự-kiện-mới)
13. [Thêm nhà cung cấp AI](#13-thêm-nhà-cung-cấp-ai)
14. [Quay video từ mô phỏng](#14-quay-video-từ-mô-phỏng)
15. [Kiểm thử](#15-kiểm-thử)
16. [Hạn chế đã biết](#16-hạn-chế-đã-biết)
17. [Ý tưởng để đóng góp](#17-ý-tưởng-để-đóng-góp)
18. [Giấy phép và ghi công](#18-giấy-phép-và-ghi-công)

---

## 1. Có gì bên trong

| | |
|---|---|
| 🏘️ **Phố thật** | 11.125 toà nhà, 1.526 đoạn đường, hồ Gươm cùng hai đảo, cầu Thê Húc, Tháp Rùa, 1.239 cây xanh, đường tàu — tất cả nướng sẵn (bake) từ OpenStreetMap thành một file 1,7 MB. |
| 🚶 **Đám đông** | ~380 người đi bộ và ~240 xe máy. Người đi theo mép đường (vì vỉa hè… để xe), xe máy đi bên phải, tìm đường bằng A* trên mạng lưới phố thật. |
| 🧠 **12 cư dân có AI** | Mỗi người có tiểu sử, quan hệ, kế hoạch trong ngày, ký ức. Họ tự quyết đi đâu, nghĩ gì, gặp người quen thì dừng lại nói chuyện. |
| 🎬 **Gõ gì, phố diễn nấy** | Một "đạo diễn" AI đọc câu bạn gõ, chọn 1 trong 17 loại sự kiện, chọn địa điểm có thật và đạo cụ. Thế giới diễn bằng tài sản dựng sẵn: lửa, khói, xe cứu hỏa, mưa, pháo hoa, đèn lồng, sân khấu, rào chắn, tàu hỏa… |
| 🕰️ **Lịch thật** | Sáng sớm tập thể dục quanh hồ, trưa ăn bún, tối cuối tuần phố đi bộ và chợ đêm Hàng Đào. |
| 🌗 **Ngày và đêm** | Mặt trời di chuyển, cửa sổ sáng đèn khi trời tối, đèn đường, đèn quanh hồ, mưa, sấm chớp. |
| 🔒 **Không máy chủ** | Toàn bộ chạy trong trình duyệt. Khoá AI của bạn chỉ gửi thẳng tới nhà cung cấp. Không có khoá thì chạy chế độ offline. |

<table>
<tr>
<td><img src="docs/images/fire-engine.jpg" alt="Xe cứu hỏa chạy tới đám cháy"></td>
<td><img src="docs/images/rain-reactions.jpg" alt="Mưa và cư dân phản ứng"></td>
</tr>
<tr>
<td><img src="docs/images/train-street.jpg" alt="Tàu qua phố đường tàu"></td>
<td><img src="docs/images/di-bao.jpg" alt="Đi bão quanh hồ Gươm"></td>
</tr>
</table>

---

## 2. Chạy thử trong 2 phút

Cần [Node.js](https://nodejs.org) 20.19 trở lên.

```bash
git clone https://github.com/BMH-AI-Technologies/bmh-world-simulation-v0.git
cd bmh-world-simulation-v0
npm install
npm run dev
```

Mở **http://localhost:3418**. Không cần cấu hình gì thêm: bản đồ đã nướng sẵn trong `public/data/pho-co.json`, và không có khoá thì cư dân chạy bằng lời thoại soạn sẵn.

Muốn bản build tĩnh để đưa lên bất kỳ hosting nào (GitHub Pages, Netlify, Vercel, S3…):

```bash
npm run build      # ra thư mục dist/ — chỉ là HTML, JS, CSS và file bản đồ
npm run preview    # xem thử bản build
```

Trình duyệt nên dùng: Chrome, Edge, Arc, Safari 17+ hoặc Firefox mới trên máy có GPU. Máy yếu vẫn chạy, chỉ là ít khung hình hơn.

---

## 3. Thêm khoá AI (và chạy không cần khoá)

Bấm **⚙** ở góc phải trên.

### Mặc định: Vercel AI Gateway + Gemini 3.8 Flash

1. Vào [vercel.com](https://vercel.com) → **AI Gateway** → **API Keys** → tạo khoá (dạng `vck_…`).
2. Dán vào ô **API key**, giữ nhà cung cấp là **Vercel AI Gateway**.
3. Model mặc định cho cả cư dân lẫn đạo diễn là `google/gemini-3.8-flash`. Bạn có thể đổi sang model khác của Gateway, ví dụ `google/gemini-3.5-flash-lite` cho rẻ hơn.
4. Bấm **Lưu**. Dải "Chế độ offline" biến mất, góc phải hiện số tiền đã dùng.

### Nhà cung cấp khác

| Nhà cung cấp | Khoá | Ghi chú |
|---|---|---|
| Vercel AI Gateway | `vck_…` | Mặc định. Một khoá dùng được Gemini, Claude, GPT… |
| Google Gemini | khoá AI Studio | Gọi thẳng Gemini API. |
| OpenAI-compatible | tuỳ dịch vụ | OpenAI, OpenRouter, DeepSeek, Groq, hoặc **Ollama / LM Studio chạy trên máy** (điền Base URL, ví dụ `http://localhost:11434/v1`, khoá để trống). |
| Anthropic | `sk-ant-…` | Gọi thẳng từ trình duyệt. |
| Mock (offline) | không cần | Lời thoại soạn sẵn, không gọi mạng. |

### Khoá của bạn đi đâu?

- Khoá **chỉ** được gửi thẳng từ trình duyệt tới nhà cung cấp bạn chọn. Không có máy chủ trung gian nào của chúng tôi.
- Nếu tick **"Nhớ khoá trên máy này"**, khoá được lưu trong `localStorage` của trình duyệt (khoá `bmh-world-sim:settings:v1`). Bỏ tick thì khoá chỉ sống trong phiên hiện tại.
- Có **giới hạn chi phí mỗi phiên** (mặc định 2 USD). Chạm mức này, cư dân tự chuyển về lời thoại soạn sẵn.

### Không có khoá?

Mọi thứ vẫn chạy: phố, đám đông, sự kiện, đạo cụ. Đạo diễn dùng bộ từ khoá (hiểu cả tiếng Việt có dấu, không dấu và tiếng Anh), còn cư dân nói theo kịch bản có sẵn của từng người. Chỉ là họ sẽ lặp lại nhiều hơn và không "nghĩ" thật.

---

## 4. Cách dùng

### Điều khiển camera

| Thao tác | Chuột | Cảm ứng |
|---|---|---|
| Kéo bản đồ | kéo chuột trái | một ngón |
| Xoay / nghiêng | kéo chuột phải | hai ngón xoay |
| Phóng to / thu nhỏ | lăn chuột | chụm hai ngón |

### Thời gian

- Đồng hồ ở giữa thanh trên cùng. Mô phỏng bắt đầu lúc **05:30 sáng thứ Bảy**.
- Ở tốc độ **1×**, 1 giây thật = 30 giây trong phố; một ngày trọn vẹn mất 48 phút.
- **4× / 16× / 64×** để tua nhanh, **❚❚** để tạm dừng (trên điện thoại ẩn nút 4× cho gọn).
- Các chip bên cạnh cho biết đang **mưa**, đang **phố đi bộ** hay **chợ đêm**.

### Theo dõi một người

- Bấm vào tên cư dân trong bảng **☺ Dân phố** (bên phải), hoặc bấm thẳng vào một người trên bản đồ.
- Camera bay tới và **bám theo** người đó. Kéo bản đồ là thôi bám; bấm lại tên để bám tiếp.
- Với cư dân, bảng hiện tiểu sử, suy nghĩ hiện tại, đang làm gì, **kế hoạch hôm nay** (mốc đang làm được tô màu) và **ký ức** gần nhất.
- Với người qua đường, bảng hiện tên, vai (người dân, du khách, người bán hàng rong, học sinh) và việc đang làm.
- Khi cư dân nói, bong bóng thoại hiện trên đầu họ.

### Tung sự kiện

1. Mở bảng **🎬 Tung sự kiện** (nút ✦ góc trái nếu đang ẩn).
2. Gõ điều bạn muốn xảy ra, bằng tiếng Việt (có dấu hay không đều được) hoặc tiếng Anh. Nhấn **Enter** hoặc bấm **Diễn!**
3. Hoặc bấm một ví dụ có sẵn.
4. Muốn chọn đúng chỗ: bấm **📍 Chọn vị trí trên bản đồ**, rồi bấm vào bản đồ. Sự kiện sẽ diễn ra ở đó.
5. Nếu câu có nhắc tên phố hay địa danh có thật ("…ở Hàng Bạc"), địa điểm đó luôn được ưu tiên.
6. Danh sách **Đang diễn ra** hiện mọi sự kiện đang chạy: bấm vào để bay tới, bấm **■** để dừng sớm.

Mẹo: các sự kiện chồng lên nhau rất vui. Thử *"cháy ở Hàng Bạc"* rồi *"mưa rào"*, xem cư dân nói gì về cả hai.

### Bản tin phố

Dải **📰 Bản tin phố** ở dưới cùng ghi lại mọi thứ: sự kiện, suy nghĩ của cư dân, các cuộc trò chuyện, lịch phố (phố đi bộ mở, chợ đêm bày hàng…). Bấm vào tên một cư dân trong bản tin để bám theo người đó.

---

## 5. Danh mục sự kiện

Đạo diễn luôn quy câu bạn gõ về một trong 17 loại dưới đây. Câu "lạ" không khớp loại nào sẽ thành **Tụ tập**: mọi người tò mò kéo tới xem. Yêu cầu bạo lực hay nhắm vào người thật cũng bị đổi thành một sự kiện tụ tập vô hại.

| Loại | Bạn sẽ thấy | Đám đông | Thử gõ |
|---|---|---|---|
| 🌧️ Mưa | mưa rơi, đường ướt, ô dù bung ra, người trú mưa | trú mưa | *mưa rào bất chợt* |
| ⛈️ Giông bão | mưa to, sấm chớp, xe ít hẳn | về nhà | *giông bão kéo đến* |
| 🔥 Hỏa hoạn | lửa, khói, ánh lửa; xe cứu hỏa từ rìa bản đồ chạy tới, lính cứu hỏa phun nước tới khi tắt | người gần chạy ra, người xa đứng xem | *cháy lớn ở Hàng Bạc* |
| 🏮 Lễ hội | dây đèn lồng dọc phố, sân khấu, đèn quét, băng rôn, pháo hoa nếu trời tối; cấm xe | kéo tới | *lễ hội Trung thu ở Hàng Mã* |
| 🦁 Múa lân | đoàn lân và trống đi quanh khu vực | kéo tới | *múa lân ở hồ Gươm* |
| 🎌 Diễu hành | đoàn người cầm cờ đi thành hàng; cấm xe | kéo tới | *diễu hành ở Đinh Tiên Hoàng* |
| 🇻🇳 Đi bão | hàng trăm xe máy cắm cờ chạy vòng hồ, pháo hoa; phố đi bộ tạm nhường đường cho xe | ăn mừng | *Việt Nam vô địch!* |
| 🔌 Mất điện | cửa sổ và đèn đường tắt trong vùng, người bật đèn điện thoại | bình thường | *mất điện ở Hàng Gai* |
| 🌊 Ngập lụt | mặt nước dâng, xe chậm hẳn, người lội nước | tránh xa | *ngập ở Hàng Bè* |
| 🚧 Cấm đường | rào chắn, CSGT phân luồng; xe tự tìm đường khác | tránh xa | *rào chắn cấm đường Hàng Đào* |
| 🛵 Tắc đường | thêm hàng chục xe, nhích từng chút | bình thường | *tắc đường ở Hàng Ngang* |
| 🚂 Tàu qua phố | tàu chạy dọc phố đường tàu (đạo diễn AI có thể thêm rào chắn) | ra xem, đứng tránh đường ray | *tàu hỏa qua phố đường tàu* |
| 🐃 Thú sổng | trâu, chó hoặc gà chạy lung tung | kéo tới | *con trâu xổng ở chợ Đồng Xuân* |
| 🎬 Quay phim | máy quay, đèn, lều, diễn viên | kéo tới | *quay MV ở Nhà thờ Lớn* |
| 🚑 Va chạm | hai xe đổ, xe cấp cứu tới, CSGT | xúm lại | *va chạm xe ở Hàng Bạc* |
| 👥 Tụ tập | bóng bay, đám đông tò mò | kéo tới | *phát quà miễn phí ở Tạ Hiện* |
| 🌙 Giãn cách | mọi người về nhà, phố vắng | về nhà | *giới nghiêm, mọi người về nhà* |

Khi có khoá AI, đạo diễn còn tự chọn **thời lượng**, **cường độ**, **đạo cụ** (rào chắn, đèn lồng, sân khấu, lều, pháo hoa, cờ, công an, xe cấp cứu, xe cứu hỏa, máy quay, bóng bay, khói, lửa, đèn quét, băng rôn, pháo giấy), và viết **tít bản tin** cùng một đoạn mô tả. Cư dân ở gần (hoặc tất cả, nếu sự kiện phủ cả khu) sẽ được báo tin và tự quyết phản ứng.

---

## 6. Các cư dân

Tất cả là nhân vật hư cấu.

| Cư dân | Là ai | Sống ở |
|---|---|---|
| **Bà Tư**, 71 | gánh xôi xéo đầu ngõ 40 năm, nhớ tên từng đứa trẻ trong phố | Hàng Bè |
| **Ông Khải**, 76 | thầy giáo văn về hưu, sáng dưỡng sinh, chiều cờ tướng | Hàng Gai |
| **Chị Hằng**, 38 | chủ quán cà phê trứng trên gác nhìn ra hồ, đang lo tiền nhà | Cầu Gỗ |
| **Anh Tùng**, 29 | thợ chạm bạc đời thứ ba, lén mở shop online | Hàng Bạc |
| **Linh**, 20 | sinh viên mỹ thuật, ký họa phố, tối chạy bàn ở Tạ Hiện | Hàng Buồm |
| **Bé Na**, 10 | cháu bà Tư, mê múa lân và kem que | Hàng Bè |
| **Cô Dung**, 47 | tiểu thương vải chợ Đồng Xuân, tính nhanh hơn máy tính | Hàng Chiếu |
| **Claire**, 34 | nhiếp ảnh gia người Pháp, đi tìm tấm ảnh hoàn hảo ở phố đường tàu | Mã Mây |
| **Chú Phong**, 52 | tổ trưởng dân phố Hàng Đào, luôn là người đầu tiên có mặt | Hàng Đào |
| **Anh Đạt**, 33 | đầu bếp bún chả, vừa nướng vừa hát | Hàng Mành |
| **Bà Hoa**, 63 | bán hoa xe đạp quanh hồ, quen ông Khải từ thời đi học | Hàng Thiếc |
| **Minh**, 26 | lập trình viên làm từ xa, viết thread về phố cổ | Lương Văn Can |

Họ hoạt động thế nào:

- **Lên kế hoạch** mỗi sáng (4–7 mốc giờ, chỉ chọn địa điểm có thật gần nhà).
- **Nghĩ** mỗi 70–130 phút trong phố: cảm xúc (một emoji), một suy nghĩ, có thể nói to, và quyết định tiếp tục, đi đâu đó, đứng lại hay về nhà.
- **Phản ứng** ngay khi có sự kiện ở gần.
- **Trò chuyện** khi hai người đứng cách nhau dưới 14 m (người quen thì chắc chắn, người lạ thì đôi khi), tối đa một lần mỗi 4 giờ cho mỗi cặp. Sau đó mỗi người ghi một dòng vào ký ức.
- **Đi ngủ** sau 23:00 và dậy từ 04:30.

---

## 7. Nhịp sống phố cổ

Người qua đường không dùng AI. Họ theo luật, nhưng luật bám theo nhịp thật của phố cổ:

- **04:30–07:00**: người lớn tuổi ra hồ tập thể dục, hàng ăn sáng mở.
- **Giờ cao điểm 07:00–09:00 và 16:30–19:00**: xe máy đông nhất.
- **Trưa**: đi ăn; chiều: cà phê, mua sắm, học sinh tan học.
- **Tối**: ăn tối, dạo hồ; du khách ra Tạ Hiện uống bia hơi.
- **Thứ Sáu, Bảy, Chủ nhật, từ 19:00**: **phố đi bộ hồ Gươm**, các tuyến quanh hồ cấm xe.
- **Thứ Sáu, Bảy, Chủ nhật, 18:00–23:00**: **chợ đêm Hàng Đào – Đồng Xuân**, có lều và đèn, cấm xe.
- Mưa thì khoảng 3 phần 10 người về nhà trú, phần lớn số còn lại bung ô; xe máy vắng bớt.

---

## 8. Chi phí

Đo thật với `google/gemini-3.8-flash` qua Vercel AI Gateway (tháng 10/2026):

- Khoảng **0,0014–0,0016 USD mỗi lần gọi**, mỗi lần 3–10 giây.
- Một buổi quay video (68 lần gọi: kế hoạch, phản ứng, trò chuyện, đạo diễn) hết **0,09 USD**.
- Một ngày mô phỏng sôi động là vài trăm lần gọi, tức cỡ **vài chục cent**.

Mẹo tiết kiệm: dùng model "lite" cho cư dân, đặt giới hạn chi phí thấp, hoặc chạy model trên máy qua Ollama (miễn phí).

Giá được tính theo bảng giá trong `src/llm/pricing.ts`, nên con số trên màn hình chỉ là ước tính.

---

## 9. Bên trong hoạt động thế nào

```
OpenStreetMap ──fetch-osm──▶ data/*.json ──bake──▶ public/data/pho-co.json
                                                        │
                                   ┌────────────────────┴───────────────────┐
                                   ▼                                        ▼
                         World (src/world)                      View (src/render, three.js)
                   graph, places, name lookup                 city, people, props, light
                                   │                                        ▲
                                   ▼                                        │
                          Sim (src/sim) ── tick ~60 lần/giây ───────────────┘
            clock · crowd · agents · events · effects · residents
                                   │
                                   ▼
                     MindRuntime (src/llm) — queue, budget, fallback
                     Gateway / Gemini / OpenAI-compatible / Anthropic / Mock
```

### Thư mục

| Đường dẫn | Việc |
|---|---|
| `scripts/fetch-osm.mjs` | tải dữ liệu OSM thô theo ô (tile), thử lại qua nhiều máy chủ Overpass |
| `scripts/bake-osm.mjs` | chiếu toạ độ về mét quanh tâm bản đồ, chuẩn hoá toà nhà, đường, nước, cây, điểm quan tâm, giữ mạng lưới đường liên thông lớn nhất |
| `src/world/world.ts` | dựng đồ thị đường đi, lưới không gian, tra tên phố (không phân biệt dấu), danh sách địa danh |
| `src/sim/path.ts` | A* có tính đến đường bị cấm, đường đông |
| `src/sim/agent.ts` | một tác tử: đi theo đường, lệch sang mép đường hoặc làn xe, đến nơi rồi làm gì tiếp |
| `src/sim/crowd.ts` | người qua đường và xe máy: ai ra đường lúc mấy giờ, đi đâu |
| `src/sim/events.ts` | 17 loại sự kiện, schema của đạo diễn, đạo diễn offline bằng từ khoá |
| `src/sim/effects.ts` | sự kiện được "diễn" thế nào: ai xuất hiện, đám đông làm gì, phố nào cấm hay chậm |
| `src/sim/residents.ts` | 12 nhân vật, prompt, schema kế hoạch, phản ứng, trò chuyện |
| `src/sim/sim.ts` | vòng lặp chính, lịch phố, tâm trí cư dân, bản tin |
| `src/llm/` | các nhà cung cấp, gọi JSON có kiểm tra schema, hàng đợi, đồng hồ chi phí, bản mock |
| `src/render/city.ts` | toà nhà gộp một mesh với shader cửa sổ sáng đèn, đường, hồ, cây, đèn đường, bồn nước inox trên mái, Tháp Rùa, cầu Thê Húc |
| `src/render/people.ts` | người và xe dạng instanced, xe cứu hỏa, lân, trâu… |
| `src/render/props.ts` | đạo cụ cho từng sự kiện, mưa, chợ đêm, đèn quanh hồ, nước ngập, tàu |
| `src/render/scene.ts` | ánh sáng theo giờ, bloom, nhãn, camera, chọn người, chế độ quay |
| `src/ui/` | giao diện React |

### Một khung hình

1. Đồng hồ tiến. Lịch phố bật hoặc tắt phố đi bộ, chợ đêm.
2. Sự kiện: kết thúc cái hết giờ, cập nhật cái đang chạy (xe cứu hỏa đến chưa, lửa còn bao nhiêu…).
3. Thỉnh thoảng một lượt đám đông phản ứng với sự kiện.
4. Người và xe: ai rảnh thì chọn việc tiếp theo, ai đang đi thì đi tiếp.
5. Cư dân: theo kế hoạch, thỉnh thoảng nghĩ, gặp nhau thì nói chuyện.
6. Vẽ: ánh sáng theo giờ, người, đạo cụ, nhãn.

Thời gian trong phố tách khỏi tốc độ đi trên màn hình: người đi khoảng 3 m/s, còn đồng hồ chạy 30 giây phố mỗi giây thật. Nhờ vậy nhìn thì tự nhiên, mà một ngày vẫn trôi đủ nhanh.

### Cách gọi AI

- Mọi lần gọi đi qua `MindRuntime`: hàng đợi ưu tiên (đạo diễn > phản ứng sự kiện > trò chuyện > kế hoạch > suy nghĩ vu vơ), tối đa 4 lần gọi cùng lúc.
- Mỗi câu trả lời được kiểm bằng **zod**. Sai thì gửi lại lỗi cho model sửa một lần. Vẫn hỏng, hoặc nhà cung cấp lỗi, thì lần gọi đó dùng bản mock, nên phố không bao giờ đứng hình.
- Với Gemini 3.x trên Gateway, mã đặt `reasoning_effort: "low"`: mặc định model "suy nghĩ" 5–17 giây và ăn hết giới hạn token.
- Cư dân nhận tình huống bằng chữ: giờ, thời tiết, đang ở phố nào, kế hoạch, ký ức, người quen gần đó, chuyện đang xảy ra, cùng danh sách địa điểm được phép chọn.

---

## 10. Fork về: đổi sang thành phố của bạn

Phần chiếu bản đồ, tìm đường, đám đông, sự kiện và hiển thị đều dùng được ở bất kỳ đâu. Một số chỗ đang viết riêng cho phố cổ Hà Nội; bảng dưới liệt kê hết để bạn biết cần sửa gì.

### Bước 1 — chọn vùng và tải dữ liệu

Chọn một khung khoảng **1–2 km mỗi cạnh**. Lớn hơn nữa thì máy chủ Overpass hay quá tải, và trình duyệt phải vẽ nhiều hơn.

Sửa `BBOX` (nam, tây, bắc, đông) ở **cả hai** file:

```js
// scripts/fetch-osm.mjs và scripts/bake-osm.mjs
const BBOX = { s: 10.7700, w: 106.6950, n: 10.7830, e: 106.7080 }; // ví dụ: quận 1, TP.HCM
```

```bash
npm run fetch-osm   # tải về data/*.json (đã nằm trong .gitignore)
npm run bake        # ra public/data/pho-co.json và in thống kê
```

Muốn đổi tên file bản đồ thì sửa đường dẫn mặc định trong `loadWorld()` ở `src/world/world.ts`.

### Bước 2 — sửa những chỗ đang viết riêng cho Hà Nội

| Ở đâu | Đang là | Bạn làm |
|---|---|---|
| `src/world/world.ts`, danh sách `pick(...)` | các địa danh phố cổ (Tháp Rùa, chợ Đồng Xuân, Ô Quan Chưởng…) | đổi sang địa danh của bạn, khớp đúng tên trong OSM |
| `src/world/world.ts`, phần hồ | tìm mặt nước tên `Hoàn Kiếm` để có landmark "Hồ Gươm" và `lakeNodes` | đổi sang hồ, quảng trường hoặc công viên trung tâm của bạn. Không có thì đi dạo quanh hồ bị bỏ qua, nhưng **đi bão cần một vòng để chạy**, nên hãy chỉ cho nó một tuyến khác |
| `src/sim/sim.ts`, `lakeWays` và `marketWays` | phố đi bộ quanh hồ, chợ đêm Hàng Đào – Hàng Ngang – Đồng Xuân | đổi tên phố hoặc bỏ luật trong `schedule()` |
| `src/sim/residents.ts`, `PROFILES` | 12 người Hà Nội; `home`, `work` và lịch trong ngày là tên phố có thật | viết nhân vật mới với tên phố của bạn (xem mục 11) |
| `src/sim/events.ts` | từ khoá tiếng Việt và tiếng Anh, prompt đạo diễn nhắc "phố cổ Hà Nội" | sửa prompt; thêm từ khoá nếu dùng ngôn ngữ khác |
| `src/sim/effects.ts`, tàu hỏa | đường ray OSM và landmark `/đường tàu/` | đổi sang tuyến ray hoặc tàu điện của bạn, hoặc bỏ loại sự kiện này |
| `src/render/city.ts`, `props.ts` | cây và đèn quanh hồ (`/Hoàn Kiếm/`), Tháp Rùa, cầu Thê Húc | đổi hoặc bỏ |
| `src/ui/i18n.ts` | tagline, câu ví dụ | viết lại cho thành phố của bạn |
| `src/sim/crowd.ts` | tỉ lệ du khách, người bán hàng rong, giờ cao điểm | chỉnh theo nhịp sống nơi bạn |

### Bước 3 — kiểm tra

```bash
npm test
```

`tests/world.test.ts` đang kiểm tra các địa danh Hà Nội: hãy đổi chúng sang địa danh của bạn. Các bài kiểm tra còn lại chạy được ở mọi thành phố.

Mẹo:

- Toà nhà thiếu số tầng sẽ được đoán theo diện tích, kiểu "nhà ống" 2–5 tầng. Thành phố nhiều nhà cao tầng thì chỉnh phần `levels` trong `bake-osm.mjs`.
- Phép chiếu là phẳng quanh tâm bản đồ, đủ chính xác cho vài km.
- Nếu Overpass báo 429 hoặc 504, chạy lại `npm run fetch-osm`: script tự thử máy chủ khác.

---

## 11. Thêm nhân vật mới

Thêm một mục vào `PROFILES` trong `src/sim/residents.ts`:

```ts
{
  key: "lan",                       // id duy nhất
  name: "Cô Lan", age: 45, female: true,
  color: 0x2a9d8f,                  // màu áo
  hat: 1,                           // 0 không, 1 nón lá, 2 mũ lưỡi trai
  job: { vi: "Bán nước chè", en: "Tea seller" },
  bio: { vi: "Bán chè chén ở góc Hàng Bông 20 năm, biết hết chuyện trong phố.", en: "…" },
  home: "Hàng Bông",                // phải là tên phố hoặc địa danh có thật trên bản đồ
  work: "Hàng Bông",
  knows: { tu: { vi: "bạn hàng", en: "fellow vendor" } },
  day: [["06:00", "Hàng Bông", { vi: "bày hàng", en: "set up" }], /* … */],   // lịch khi chạy offline
  voice: { vi: ["Chè nóng đây!"], en: ["Hot tea here!"] },                   // câu nói khi chạy offline
}
```

- `home` và `work` phải tra được bằng `world.resolvePlace()`. Không tra được thì nhân vật xuất hiện ở hồ.
- `knows` dùng `key` của người khác. Người quen gặp nhau là chắc chắn nói chuyện.
- `bio` là thứ model đọc nhiều nhất: viết cụ thể (nghề, thói quen, nỗi lo) thì nhân vật sẽ sống hơn.

---

## 12. Thêm loại sự kiện mới

Ví dụ thêm "biểu diễn nghệ thuật đường phố":

1. **`src/sim/events.ts`**: thêm `"busker"` vào `EVENT_KINDS`, rồi thêm một mục vào `CATALOG` (icon, tên Việt/Anh, mô tả cho đạo diễn, bán kính, thời lượng, phản ứng đám đông, đạo cụ mặc định, từ khoá). Thêm `"busker"` vào `MATCH_ORDER`, đặt trước các loại chung chung hơn.
2. **`src/sim/effects.ts`**: trong `startEvent` sinh tác nhân (`sim.spawnActor`), cấm hoặc làm chậm phố (`ev.fx.ways`), lưu trạng thái vào `ev.fx`. Trong `tickEvent` cập nhật mỗi khung hình. Trong `endEvent` dọn dẹp.
3. **`src/render/props.ts`**: trong `build()` thêm hình ảnh cho `ev.kind === "busker"`. Hình ảnh chỉ đọc `ev.fx`, không tự sửa trạng thái.
4. **`src/render/people.ts`**: nếu cần mesh mới cho tác nhân (như trâu hay lân), thêm vào `makeSpecial`.
5. **Kiểm thử**: thêm một câu vào `tests/events.test.ts`, và vào danh sách "performs every event kind" trong `tests/sim.test.ts`.

Muốn thêm **đạo cụ** dùng chung cho mọi sự kiện, thêm tên vào `PROPS` (đạo diễn sẽ thấy nó) và vẽ nó trong `props.ts`.

---

## 13. Thêm nhà cung cấp AI

1. Viết `src/llm/providers/<ten>.ts`, trả về `{ id, complete(req) }`. Xem `gemini.ts` hoặc `anthropic.ts` làm mẫu: gửi `system`, `prompt`, `schema` nếu nhà cung cấp hỗ trợ, trả về `{ text, usage }`.
2. Thêm `ProviderId` trong `src/llm/types.ts`, một nhánh trong `createProvider()` (`src/llm/index.ts`), model mặc định và giá trong `src/llm/pricing.ts`, tên hiển thị trong `PROVIDER_LABEL`.
3. Nhà cung cấp phải cho phép gọi thẳng từ trình duyệt (CORS). Nếu không, đây không còn là app "không cần máy chủ" nữa.

Kiểm tra với model thật:

```bash
AI_GATEWAY_API_KEY=vck_… npm run test:live
# đổi model:
AI_GATEWAY_API_KEY=vck_… SIM_MODEL=google/gemini-3.5-flash-lite npm run test:live
```

---

## 14. Quay video từ mô phỏng

Máy nào cũng quay được video 30 khung hình/giây mượt, kể cả máy yếu. Trong console của trình duyệt:

```js
const { sim, view } = window.bmhSim;
view.manual = true;          // dừng vòng lặp thời gian thực
view.advance(1 / 30);        // tiến đúng một khung hình — rồi chụp màn hình
sim.speed = 4;               // tốc độ vẫn có tác dụng ở chế độ này
```

Vì thế giới chỉ tiến khi bạn gọi `advance()`, thời gian chờ model trả lời không hiện thành chỗ khựng trong video.

Muốn chụp nhanh vài cảnh thì có `npm run shoot` (cần dev server đang chạy và Chrome). Các tuỳ chọn `SCENES=…` nằm trong `scripts/shoot.mjs`.

---

## 15. Kiểm thử

```bash
npm test             # offline: bản đồ, tìm đường, đạo diễn từ khoá, mọi loại sự kiện, lịch phố, tàu, đi bão
npm run typecheck
npm run test:live    # cần AI_GATEWAY_API_KEY: đạo diễn, kế hoạch, phản ứng, trò chuyện với model thật
npm run shoot        # ảnh chụp vài cảnh (cần `npm run dev` và Chrome)
```

---

## 16. Hạn chế đã biết

- **Người rất nhỏ khi nhìn xa.** Họ đã được phóng to 1,5 lần; muốn xem kỹ thì bám theo một người.
- **Chế độ offline lặp lời.** Lời soạn sẵn có ít, nhiều cư dân sẽ nói giống nhau. Có khoá AI thì khác hẳn.
- **Cư dân chỉ đi bộ**, chưa biết đi xe máy.
- **Không lưu trạng thái.** Tải lại trang là phố quay về 05:30.
- **Đám đông không va chạm nhau.** Người có thể đi xuyên qua nhau khi đứng đông.
- **Hiệu năng trên máy yếu và điện thoại cũ** chưa được đo kỹ. Trên điện thoại, số người và xe đã được giảm sẵn.
- **Đạo diễn offline** chỉ hiểu theo từ khoá, nên có lúc hiểu sai câu lạ. Đạo diễn AI hiểu tốt hơn nhiều.
- **Giá trong `pricing.ts` có thể cũ.** Hãy xem đồng hồ chi phí như ước tính.
- Rìa bản đồ là mặt phẳng; ban đêm sương mù che đi, ban ngày nhìn xa vẫn thấy.

---

## 17. Ý tưởng để đóng góp

- 🗺️ **Bản đồ 02**: thành phố của bạn — Sài Gòn, Hội An, Đà Lạt, Huế, hay bất kỳ đâu.
- 💾 **Lưu và chia sẻ kịch bản**: xuất chuỗi sự kiện ra một đường link để người khác mở lại đúng cảnh đó.
- 🧠 **Ký ức dài hạn**: tóm tắt ký ức mỗi đêm, quan hệ thay đổi theo thời gian.
- 🛵 **Cư dân đi xe máy**, đi xe buýt.
- 🗣️ **Giọng nói** cho bong bóng thoại.
- 💻 **Model chạy ngay trong trình duyệt** (WebGPU) để chơi miễn phí, không cần khoá.
- 🧪 **Thí nghiệm có đo lường**: ví dụ "cấm xe Hàng Đào cả ngày thì giao thông các phố bên cạnh ra sao?", xuất số liệu ra CSV.
- 🎨 Mesh đẹp hơn cho người, xe, đạo cụ; mái ngói thật thay cho mái phẳng.

### Cách đóng góp

1. Fork, tạo nhánh, sửa.
2. `npm test` và `npm run typecheck` phải qua.
3. Mở Pull Request: mô tả bạn đổi gì, kèm ảnh chụp nếu có thay đổi về hình ảnh.
4. Code mới nên giống code xung quanh: TypeScript strict, không thêm máy chủ, không gửi dữ liệu đi đâu ngoài nhà cung cấp AI người dùng tự chọn.

---

## 18. Giấy phép và ghi công

- Mã nguồn: **MIT** — xem [LICENSE](LICENSE).
- Dữ liệu bản đồ: © **OpenStreetMap contributors**, theo giấy phép [ODbL 1.0](https://www.openstreetmap.org/copyright). Ghi công này luôn hiển thị trong app và nằm sẵn trong file bản đồ. Nếu bạn phân phối bản đồ đã nướng, hãy giữ nguyên nó.
- Tất cả cư dân là **nhân vật hư cấu**; mọi sự trùng hợp là ngẫu nhiên.
- Một dự án mã nguồn mở của **BMH AI Technologies**.
