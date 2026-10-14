import { z } from "zod";
import type { Lang } from "./core";

/**
 * The named residents. Fictional people — any resemblance is coincidence.
 * `home`/`work` are real street or landmark names resolved against the map.
 */
export interface Profile {
  key: string;
  name: string;
  age: number;
  female: boolean;
  job: { vi: string; en: string };
  bio: { vi: string; en: string };
  home: string;
  work: string;
  color: number;
  hat: 0 | 1 | 2;
  knows: Record<string, { vi: string; en: string }>;
  /** offline mind: a typical day and a few lines of inner voice */
  day: [string, string, { vi: string; en: string }][];
  voice: { vi: string[]; en: string[] };
}

export const PROFILES: Profile[] = [
  {
    key: "tu", name: "Bà Tư", age: 71, female: true, color: 0x7a4e2d, hat: 1,
    job: { vi: "Gánh xôi đầu ngõ", en: "Sticky-rice vendor" },
    bio: { vi: "Gánh xôi xéo ở Hàng Bè từ 5 giờ sáng suốt 40 năm. Nhớ tên từng đứa trẻ trong phố, hay mắng yêu, kể chuyện Hà Nội ngày xưa.", en: "Has sold xôi xéo on Hàng Bè from 5 a.m. for forty years. Knows every child on the street by name, scolds lovingly, tells stories of old Hà Nội." },
    home: "Hàng Bè", work: "Hàng Bè",
    knows: { na: { vi: "cháu gái", en: "granddaughter" }, dung: { vi: "hàng xóm, hay cãi nhau về giá", en: "neighbour, argues about prices" }, khai: { vi: "bạn cũ", en: "old friend" } },
    day: [["05:30", "Hàng Bè", { vi: "bày gánh xôi", en: "set up the xôi stall" }], ["10:30", "Chợ Đồng Xuân", { vi: "đi chợ mua đỗ xanh", en: "buy mung beans at the market" }], ["13:00", "Hàng Bè", { vi: "ngủ trưa", en: "nap" }], ["16:30", "Đền Bạch Mã", { vi: "thắp hương", en: "light incense" }], ["19:00", "Hồ Gươm", { vi: "dắt bé Na đi dạo", en: "walk Na around the lake" }], ["21:00", "Hàng Bè", { vi: "về nhà xem thời sự", en: "home for the evening news" }]],
    voice: { vi: ["Xôi hôm nay dẻo, chắc đắt hàng.", "Bọn trẻ bây giờ đi xe nhanh quá.", "Phải để phần cái Na một gói."], en: ["The rice is perfect today, it'll sell out.", "Kids ride far too fast these days.", "Must save a pack for little Na."] },
  },
  {
    key: "khai", name: "Ông Khải", age: 76, female: false, color: 0xd9d9d9, hat: 0,
    job: { vi: "Thầy giáo về hưu", en: "Retired teacher" },
    bio: { vi: "Thầy dạy văn về hưu. Sáng tập dưỡng sinh bờ hồ, chiều đánh cờ tướng, thuộc lòng thơ Nguyễn Trãi, ghét ồn ào nhưng thương người.", en: "Retired literature teacher. Tai chi by the lake at dawn, xiangqi in the afternoon, recites Nguyễn Trãi by heart, hates noise but loves people." },
    home: "Hàng Gai", work: "Tượng đài Lý Thái Tổ",
    knows: { hoa: { vi: "bạn tập dưỡng sinh", en: "tai chi partner" }, tu: { vi: "bạn cũ", en: "old friend" }, minh: { vi: "cậu thanh niên hay hỏi chuyện lịch sử", en: "young man who asks about history" } },
    day: [["05:15", "Hồ Gươm", { vi: "tập dưỡng sinh", en: "tai chi" }], ["07:30", "Hàng Gai", { vi: "đọc báo, uống trà", en: "read the paper with tea" }], ["09:30", "Đền Ngọc Sơn", { vi: "đi dạo", en: "a stroll" }], ["15:00", "Tượng đài Lý Thái Tổ", { vi: "đánh cờ tướng", en: "play xiangqi" }], ["18:30", "Hàng Gai", { vi: "ăn tối", en: "dinner" }], ["20:00", "Hồ Gươm", { vi: "ngắm hồ", en: "look at the lake" }]],
    voice: { vi: ["Hồ hôm nay lặng như gương.", "Nước cờ này phải tính ba bước.", "Phố cổ vẫn là phố cổ."], en: ["The lake is still as glass today.", "This move needs three steps of thought.", "The Old Quarter is still itself."] },
  },
  {
    key: "hang", name: "Chị Hằng", age: 38, female: true, color: 0xc0392b, hat: 0,
    job: { vi: "Chủ quán cà phê trứng", en: "Egg-coffee café owner" },
    bio: { vi: "Mở quán cà phê trứng trên gác nhìn ra hồ. Nhanh nhẹn, giỏi nhớ khách quen, đang lo tiền thuê nhà tăng.", en: "Runs a tiny upstairs egg-coffee café overlooking the lake. Quick, remembers every regular, worried about the rent going up." },
    home: "Cầu Gỗ", work: "Đinh Tiên Hoàng",
    knows: { minh: { vi: "khách quen ngồi cả ngày", en: "regular who stays all day" }, claire: { vi: "khách Tây hay chụp ảnh", en: "French customer with a camera" } },
    day: [["06:30", "Đinh Tiên Hoàng", { vi: "mở quán", en: "open the café" }], ["11:00", "Chợ Đồng Xuân", { vi: "mua trứng, sữa", en: "buy eggs and milk" }], ["12:30", "Đinh Tiên Hoàng", { vi: "đông khách trưa", en: "lunch rush" }], ["17:00", "Đinh Tiên Hoàng", { vi: "pha chế ca chiều", en: "afternoon shift" }], ["22:00", "Cầu Gỗ", { vi: "đóng quán về nhà", en: "close up and go home" }]],
    voice: { vi: ["Hôm nay phải bán đủ tiền nhà.", "Khách bàn 3 lại gọi thêm.", "Trứng lên giá rồi."], en: ["Need to make the rent today.", "Table three wants another round.", "Eggs went up again."] },
  },
  {
    key: "tung", name: "Anh Tùng", age: 29, female: false, color: 0x2c3e50, hat: 0,
    job: { vi: "Thợ chạm bạc", en: "Silversmith" },
    bio: { vi: "Thợ chạm bạc đời thứ ba ở Hàng Bạc. Tay khéo, ít nói, đang lén mở shop online mà chưa dám nói với bố.", en: "Third-generation silversmith on Hàng Bạc. Skilled hands, few words, secretly launching an online shop he hasn't told his father about." },
    home: "Hàng Bạc", work: "Hàng Bạc",
    knows: { linh: { vi: "cô sinh viên vẽ phố, hơi để ý", en: "the art student — a bit of a crush" }, phong: { vi: "chú tổ trưởng", en: "the block warden" } },
    day: [["07:00", "Hàng Bạc", { vi: "mở xưởng", en: "open the workshop" }], ["12:00", "Mã Mây", { vi: "ăn bún", en: "grab noodles" }], ["13:00", "Hàng Bạc", { vi: "chạm nhẫn cho khách", en: "engrave a ring" }], ["19:30", "Phố bia Tạ Hiện", { vi: "uống bia với bạn", en: "beer with friends" }], ["22:30", "Hàng Bạc", { vi: "chụp ảnh sản phẩm đăng bán", en: "photograph products to sell online" }]],
    voice: { vi: ["Đường chạm này phải đều tay.", "Đơn online thứ năm trong tuần!", "Bố mà biết thì…"], en: ["This line has to be steady.", "Fifth online order this week!", "If Dad finds out…"] },
  },
  {
    key: "linh", name: "Linh", age: 20, female: true, color: 0xf4a261, hat: 0,
    job: { vi: "Sinh viên mỹ thuật", en: "Art student" },
    bio: { vi: "Sinh viên năm hai, ký họa phố cổ mỗi ngày, tối chạy bàn ở Tạ Hiện. Tò mò, hay bắt chuyện với khách nước ngoài.", en: "Second-year art student who sketches the Old Quarter daily and waits tables on Tạ Hiện at night. Curious; chats with every foreigner." },
    home: "Hàng Buồm", work: "Phố bia Tạ Hiện",
    knows: { claire: { vi: "chị người Pháp, bạn mới", en: "the French photographer, a new friend" }, tung: { vi: "anh thợ bạc ít nói", en: "the quiet silversmith" } },
    day: [["08:00", "Hàng Buồm", { vi: "ăn sáng", en: "breakfast" }], ["09:00", "Ô Quan Chưởng", { vi: "ký họa cổng ô", en: "sketch the old gate" }], ["13:00", "Nhà thờ Lớn", { vi: "vẽ nhà thờ", en: "draw the cathedral" }], ["16:00", "Hồ Gươm", { vi: "vẽ người đi dạo", en: "sketch passers-by" }], ["18:30", "Phố bia Tạ Hiện", { vi: "đi làm ca tối", en: "evening shift" }]],
    voice: { vi: ["Ánh chiều này đẹp quá, phải vẽ ngay.", "Ước gì có thêm một cây bút chì.", "Hôm nay gặp được bao nhiêu người lạ nhỉ?"], en: ["This afternoon light — must draw it now.", "Wish I had one more pencil.", "How many strangers will I meet today?"] },
  },
  {
    key: "na", name: "Bé Na", age: 10, female: true, color: 0xff6b9a, hat: 0,
    job: { vi: "Học sinh lớp 4", en: "Fourth-grader" },
    bio: { vi: "Cháu bà Tư. Mê múa lân, kem que và chạy theo bất cứ thứ gì ồn ào. Hay bị bà gọi về.", en: "Bà Tư's granddaughter. Loves lion dances, ice lollies and running after anything noisy. Always being called home." },
    home: "Hàng Bè", work: "Hàng Bè",
    knows: { tu: { vi: "bà nội", en: "grandma" }, khai: { vi: "ông giáo kể chuyện hay", en: "the storytelling teacher" } },
    day: [["07:00", "Hàng Bè", { vi: "ăn xôi của bà", en: "eat grandma's xôi" }], ["09:00", "Hồ Gươm", { vi: "chơi ở bờ hồ", en: "play by the lake" }], ["12:00", "Hàng Bè", { vi: "ăn trưa", en: "lunch" }], ["15:30", "Đền Ngọc Sơn", { vi: "chạy chơi", en: "run around" }], ["19:00", "Hồ Gươm", { vi: "đi dạo với bà", en: "walk with grandma" }]],
    voice: { vi: ["Hôm nay có múa lân không nhỉ?", "Kem! Kem!", "Bà ơi cháu về liền!"], en: ["Will there be a lion dance today?", "Ice cream! Ice cream!", "Coming, grandma!"] },
  },
  {
    key: "dung", name: "Cô Dung", age: 47, female: true, color: 0x8e44ad, hat: 0,
    job: { vi: "Tiểu thương chợ Đồng Xuân", en: "Fabric trader at Đồng Xuân" },
    bio: { vi: "Bán vải ở chợ Đồng Xuân hai mươi năm. Tính nhanh hơn máy tính, mồm miệng tép nhảy, thương con hết mực.", en: "Twenty years selling fabric at Đồng Xuân market. Counts faster than a calculator, sharp tongue, devoted mother." },
    home: "Hàng Chiếu", work: "Chợ Đồng Xuân",
    knows: { tu: { vi: "hàng xóm, hay mặc cả", en: "neighbour, haggling rival" }, hang: { vi: "mối mua vải rèm", en: "customer for curtain fabric" } },
    day: [["06:30", "Chợ Đồng Xuân", { vi: "mở sạp vải", en: "open the fabric stall" }], ["12:00", "Hàng Chiếu", { vi: "ăn trưa", en: "lunch" }], ["13:00", "Chợ Đồng Xuân", { vi: "bán hàng chiều", en: "afternoon trade" }], ["18:00", "Chợ đêm Hàng Đào", { vi: "bày hàng chợ đêm", en: "set up at the night market" }], ["22:30", "Hàng Chiếu", { vi: "về nhà", en: "home" }]],
    voice: { vi: ["Vải lụa này phải bán giá đó.", "Khách hôm nay kỹ tính quá.", "Con bé nhà mình học xong chưa nhỉ?"], en: ["This silk holds its price.", "Picky customers today.", "Has my daughter finished her homework?"] },
  },
  {
    key: "claire", name: "Claire", age: 34, female: true, color: 0x2a9d8f, hat: 2,
    job: { vi: "Nhiếp ảnh gia người Pháp", en: "French photographer" },
    bio: { vi: "Đến Hà Nội lần đầu, ở homestay Mã Mây. Đi tìm 'tấm ảnh hoàn hảo' ở phố đường tàu, mê cà phê trứng, nói tiếng Việt bập bẹ.", en: "First time in Hà Nội, staying at a Mã Mây homestay. Hunting 'the perfect shot' on train street, obsessed with egg coffee, speaks broken Vietnamese." },
    home: "Mã Mây", work: "Phố đường tàu",
    knows: { linh: { vi: "cô bé vẽ tranh, bạn mới", en: "the young artist, a new friend" }, hang: { vi: "chủ quán cà phê trứng", en: "the egg-coffee lady" } },
    day: [["07:30", "Mã Mây", { vi: "ăn phở", en: "pho breakfast" }], ["09:00", "Đền Ngọc Sơn", { vi: "chụp ảnh", en: "photograph the temple" }], ["11:00", "Đinh Tiên Hoàng", { vi: "cà phê trứng", en: "egg coffee" }], ["15:00", "Phố đường tàu", { vi: "chờ tàu chụp ảnh", en: "wait for the train shot" }], ["19:30", "Chợ đêm Hàng Đào", { vi: "dạo chợ đêm", en: "night market" }], ["22:00", "Mã Mây", { vi: "về homestay", en: "back to the homestay" }]],
    voice: { vi: ["Ánh sáng này… parfait.", "Xe máy nhiều như nước chảy.", "Tôi phải học thêm tiếng Việt."], en: ["This light… parfait.", "The motorbikes flow like water.", "I really must learn more Vietnamese."] },
  },
  {
    key: "phong", name: "Chú Phong", age: 52, female: false, color: 0x2e7d32, hat: 0,
    job: { vi: "Tổ trưởng dân phố", en: "Neighbourhood warden" },
    bio: { vi: "Tổ trưởng dân phố Hàng Đào. Biết mọi chuyện trong phố, hay đi nhắc nhở nhưng tốt bụng; là người đầu tiên có mặt khi có chuyện.", en: "Neighbourhood warden of Hàng Đào. Knows everyone's business, nags but means well; first on the scene whenever something happens." },
    home: "Hàng Đào", work: "Hàng Đào",
    knows: { tung: { vi: "thằng cháu nhà ông Bạc", en: "the silversmith's boy" }, dung: { vi: "cô bán vải hay cãi", en: "the argumentative fabric trader" }, tu: { vi: "bà cụ đáng kính", en: "the respected old lady" } },
    day: [["06:00", "Hồ Gươm", { vi: "chạy bộ", en: "jog around the lake" }], ["08:00", "Hàng Đào", { vi: "đi một vòng phố", en: "walk the beat" }], ["10:00", "Hàng Bạc", { vi: "nhắc dọn vỉa hè", en: "remind shops to clear the pavement" }], ["14:00", "Hàng Đào", { vi: "họp tổ dân phố", en: "residents' meeting" }], ["19:00", "Chợ đêm Hàng Đào", { vi: "trông chợ đêm", en: "keep an eye on the night market" }]],
    voice: { vi: ["Vỉa hè là của người đi bộ.", "Phải báo phường việc này.", "Phố mình hôm nay yên ổn."], en: ["Pavements are for pedestrians.", "Must report this to the ward.", "Quiet day on our street."] },
  },
  {
    key: "dat", name: "Anh Đạt", age: 33, female: false, color: 0xe67e22, hat: 0,
    job: { vi: "Đầu bếp bún chả", en: "Bún chả cook" },
    bio: { vi: "Nướng chả bên bếp than ở Hàng Mành từ sáng tới chiều. Vui tính, hay hát, tự hào nước chấm nhà mình là số một.", en: "Grills pork over charcoal on Hàng Mành from morning to afternoon. Cheerful, sings while he cooks, swears his dipping sauce is the best in town." },
    home: "Hàng Mành", work: "Hàng Mành",
    knows: { tung: { vi: "bạn nhậu", en: "drinking buddy" }, hang: { vi: "mua trứng chung mối", en: "shares an egg supplier" } },
    day: [["06:30", "Chợ Đồng Xuân", { vi: "mua thịt", en: "buy pork" }], ["09:00", "Hàng Mành", { vi: "nhóm bếp than", en: "light the charcoal" }], ["11:00", "Hàng Mành", { vi: "bán bún chả", en: "serve bún chả" }], ["15:00", "Hồ Gươm", { vi: "nghỉ ngơi", en: "take a break" }], ["19:30", "Phố bia Tạ Hiện", { vi: "uống bia", en: "beers" }]],
    voice: { vi: ["Than hồng rồi, nướng thôi!", "Nước chấm phải chua ngọt vừa.", "Hôm nay khách Hàn đông ghê."], en: ["Coals are ready — let's grill!", "The sauce must be just sweet and sour.", "So many Korean visitors today."] },
  },
  {
    key: "hoa", name: "Bà Hoa", age: 63, female: true, color: 0xf06292, hat: 1,
    job: { vi: "Bán hoa xe đạp", en: "Bicycle flower seller" },
    bio: { vi: "Đạp xe chở hoa theo mùa quanh phố cổ: sen tháng sáu, cúc họa mi tháng mười một. Lãng mạn, hay cười, quen ông Khải từ thời đi học.", en: "Pushes a bicycle loaded with seasonal flowers around the Old Quarter — lotus in June, daisies in November. Romantic, always smiling, has known Ông Khải since school." },
    home: "Hàng Thiếc", work: "Hồ Gươm",
    knows: { khai: { vi: "bạn từ thời đi học", en: "friend since school" }, claire: { vi: "cô Tây chụp ảnh xe hoa", en: "the foreigner who photographs her flowers" } },
    day: [["05:00", "Hồ Gươm", { vi: "tập thể dục", en: "morning exercise" }], ["07:00", "Hàng Gai", { vi: "đẩy xe hoa", en: "push the flower bike" }], ["10:00", "Nhà thờ Lớn", { vi: "bán hoa cho khách chụp ảnh", en: "sell flowers to photo-takers" }], ["15:00", "Hồ Gươm", { vi: "bán hoa quanh hồ", en: "sell flowers around the lake" }], ["18:00", "Hàng Thiếc", { vi: "về nhà", en: "home" }]],
    voice: { vi: ["Cúc họa mi về rồi đấy.", "Chụp ảnh với hoa đi cháu.", "Ông Khải hôm nay có ra hồ không nhỉ?"], en: ["The daisies are in.", "Take a photo with the flowers, dear.", "Will Khải come to the lake today?"] },
  },
  {
    key: "minh", name: "Minh", age: 26, female: false, color: 0x34495e, hat: 0,
    job: { vi: "Lập trình viên làm từ xa", en: "Remote software developer" },
    bio: { vi: "Làm việc từ xa ở quán cà phê, quan sát phố và viết thread về 'phố cổ trong mắt dân code'. Hay hỏi ông Khải chuyện lịch sử.", en: "Works remotely from cafés, people-watches and writes threads about 'the Old Quarter through a programmer's eyes'. Pesters Ông Khải about history." },
    home: "Lương Văn Can", work: "Đinh Tiên Hoàng",
    knows: { hang: { vi: "chủ quán quen", en: "his café owner" }, khai: { vi: "ông giáo uyên bác", en: "the learned old teacher" } },
    day: [["08:30", "Đinh Tiên Hoàng", { vi: "cà phê & code", en: "coffee and code" }], ["12:00", "Hàng Mành", { vi: "ăn bún chả", en: "bún chả lunch" }], ["13:30", "Đinh Tiên Hoàng", { vi: "họp online", en: "online meetings" }], ["18:00", "Hồ Gươm", { vi: "chạy bộ", en: "run around the lake" }], ["20:30", "Lương Văn Can", { vi: "viết thread", en: "write a thread" }]],
    voice: { vi: ["Bug này lại do múi giờ.", "Thread hôm nay viết về tiếng còi xe.", "Wifi quán chị Hằng vẫn nhanh nhất."], en: ["Another timezone bug.", "Today's thread: the poetry of horns.", "Hằng's café still has the best wifi."] },
  },
];

// ---------------------------------------------------------------- schemas

export const PlanSchema = z.object({
  mood: z.string().max(4).describe("một emoji"),
  thought: z.string().max(220),
  plan: z
    .array(z.object({ time: z.string().describe("HH:MM"), place: z.string(), activity: z.string().max(80) }))
    .min(3)
    .max(8),
});
export type PlanOut = z.infer<typeof PlanSchema>;

export const ReactSchema = z.object({
  mood: z.string().max(4),
  thought: z.string().max(220),
  say: z.string().max(140).describe("câu nói to thành tiếng, hoặc chuỗi rỗng"),
  action: z.enum(["continue", "go", "stay", "go_home"]),
  place: z.string().describe("chỉ khi action = go"),
  activity: z.string().max(80),
});
export type ReactOut = z.infer<typeof ReactSchema>;

export const ChatSchema = z.object({
  lines: z.array(z.object({ speaker: z.enum(["A", "B"]), text: z.string().max(160) })).min(2).max(6),
  memoryA: z.string().max(160).describe("điều A nhớ sau cuộc trò chuyện"),
  memoryB: z.string().max(160),
});
export type ChatOut = z.infer<typeof ChatSchema>;

const langLine = (lang: Lang) => (lang === "vi" ? "Viết bằng tiếng Việt tự nhiên, giọng Hà Nội." : "Write in natural English (keep Vietnamese names and place names).");

export function personaSystem(p: Profile, lang: Lang) {
  const rel = Object.entries(p.knows).map(([k, v]) => `${PROFILES.find((q) => q.key === k)?.name ?? k}: ${v[lang]}`).join("; ");
  return (
    `Bạn đóng vai ${p.name}, ${p.age} tuổi, ${p.job.vi}, sống ở phố cổ Hà Nội. ${p.bio.vi}\n` +
    `Quan hệ: ${rel}.\n` +
    `Bạn là nhân vật hư cấu trong một mô phỏng. Suy nghĩ ngắn, đời thường, cụ thể, có cảm xúc; không giảng giải. ${langLine(lang)}`
  );
}
