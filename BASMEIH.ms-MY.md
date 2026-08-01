# Terjemahan Basmeih - Latar Belakang, Peraturan Lipatan & Ketepatan

Dokumen ini membicarakan **terjemahan Melayu Basmeih** (`ms.basmeih`, *Tafsir Pimpinan Ar-Rahman*): apa ia, dari mana asalnya, terminologi Melayu yang digunakannya, dan **algoritma lipatan / carian** yang diaplikasikan oleh projek ini ke atasnya. Ia juga melukis garis penting antara *terjemahan* dan *tafsir*.

> Dokumen berkaitan: [API.ms-MY.md](API.ms-MY.md) (API JSON) | [README.ms-MY.md](README.ms-MY.md) (gambaran keseluruhan projek) | [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Jadual kandungan

- [Apakah terjemahan Basmeih](#apakah-terjemahan-basmeih)
- [Bilakah ia dicipta](#bilakah-ia-dicipta)
- [Terminologi Melayu & standardisasi](#terminologi-melayu--standardisasi)
- [Model data - Arab, Melayu, Inggeris](#model-data--arab-melayu-inggeris)
- [Peraturan lipatan (algoritma normalisasi)](#peraturan-lipatan-algoritma-normalisasi)
- [Semua peraturan pemadanan](#semua-peraturan-pemadanan)
- [Algoritma dalam proses carian](#algoritma-dalam-proses-carian)
- [Ketepatan terjemahan vs tafsir](#ketepatan-terjemahan-vs-tafsir)

---

## Apakah terjemahan Basmeih

Terjemahan **Basmeih** ialah rendering Melayu Al-Quran yang dihasilkan sebagai ***Tafsir Pimpinan Ar-Rahman*** - secara harfiah *"Tafsir Panduan Ar-Rahman (Yang Maha Pemurah)"*. Ia adalah terjemahan Al-Quran Melayu **rasmi di Malaysia** yang digunakan di masjid, sekolah, dan penerbitan rasmi.

| Medan | Nilai (seperti yang disimpan dalam jadual `editions` projek ini) |
| --- | --- |
| identifier | `ms.basmeih` |
| language | `ms` (Melayu) |
| name | `Basmeih` |
| english_name | `Abdullah Muhammad Basmeih` |
| type | `translation` |
| liputan | kesemua **6,236** ayat |

Ia dinamai sempena ketua ilmuannya, **Dato' Haji Abdullah bin Muhammad Basmeih**, yang mengetuai kerja terjemahan/tafsir di bawah naungan **JAKIM** (*Jabatan Kemajuan Islam Malaysia*). Dalam projek ini, teksnya diperoleh daripada API awam [alquran.cloud](https://alquran.cloud) sebagai edisi `ms.basmeih`.

## Bilakah ia dicipta

*Tafsir Pimpinan Ar-Rahman* adalah projek kerajaan yang mengambil masa bertahun-tahun; jilidnya dihasilkan dan diterbitkan secara berperingkat pada **akhir abad ke-20** (kerja itu merangkumi 1980an-1990an, dengan set lengkap diterbitkan sepanjang tempoh itu). Ia kekal menjadi rujukan tafsir Melayu standard dan telah dicetak semula berkali-kali.

> ⚠️ **Sahkan sebelum memetik.** Tahun penerbitan tepat dan sejarah edisi perlu disahkan terhadap rekod JAKIM dan Dewan Bahasa dan Pustaka (DBP) - projek ini mendokumentasikan *perisian/set data*, bukan sejarah penerbitan tafsir. Jika anda boleh mengesahkan atau membetulkan tarikh, sila buka isu atau PR (lihat [CONTRIBUTING.md](CONTRIBUTING.md) - kami secara eksplisit menjemput `ulamā` dan DBP untuk membantu).

## Terminologi Melayu & standardisasi

Teks Basmeih ditulis dalam **Bahasa Melayu rasmi** dan menggunakan **terminologi Islam Melayu tradisional**. Jadual di bawah dikira daripada 6,236 ayat sebenar dalam set data ini (kiraan kejadian):

| Konsep | Bentuk digunakan Basmeih | Kiraan | Alternatif moden / serantau (TIDAK digunakan) |
| --- | --- | --- | --- |
| syurga | **syurga** | 188 | *surga* (Indonesia) - 0 |
| Tuhan | **Allah** | 2,288 | - |
| tuhan (generik) | **Tuhan** | 663 | - |
| nabi | **nabi** | 606 | - |
| rasul | **rasul** | 297 | - |
| sembahyang | **sembahyang** | 95 | *solat* (standard moden) / *shalat* (Indonesia) - 0 |
| doa | **dua** + **doa** | 136 / 25 | kedua-dua bentuk muncul; *dua* lebih kerap |
| iman | **beriman** | 730 | - |

**Akibat praktikal bagi carian:** kerana Basmeih menggunakan *sembahyang* (bukan *solat*) dan *syurga* (bukan *surga*), pengguna yang menaip bentuk moden/Indonesia akan mendapat **sifar padanan**. Peraturan lipatan di bawah mengendalikan diakritik dan huruf besar, tetapi ia **tidak** memetakan antara ejaan sinonim. Inilah punca paling biasa "kenapa carian saya tidak memadan?". (Pemetaan sinonim rentas-dialek adalah jurang yang diketahui - sumbangan dialu-alukan; lihat [CONTRIBUTING.md](CONTRIBUTING.md).)

Standardisasi terminologi Islam Melayu di Malaysia diawasi oleh **JAKIM** dan badan bahasa **Dewan Bahasa dan Pustaka (DBP)**. Teks Basmeih mendahului beberapa standardisasi DBP moden, sebab itulah bentuk lama seperti *sembahyang* muncul.

## Model data - Arab, Melayu, Inggeris

Satu titik kekeliruan biasa ialah peranan ketiga-tiga skrip/bahasa dalam projek ini. **Tiada terjemahan mesin** - Arab ialah kitab asal, Melayu ialah terjemahan manusia Basmeih, dan Inggeris hanya muncul sebagai **metadata** (nama surah). Mereka berada dalam medan berbeza:

```mermaid
flowchart LR
  classDef ar    fill:#2C1A10,stroke:#CA8A04,color:#F5E6D3
  classDef ms    fill:#991B1B,stroke:#CA8A04,color:#F5E6D3
  classDef en    fill:#581C87,stroke:#CA8A04,color:#F5E6D3
  classDef src   fill:#3D2618,stroke:#CA8A04,color:#F5E6D3

  S("["Kitab Arab<br/>teks Quran asal"]"):::ar
  B("["Basmeih (manusia)<br/>Arab -&gt; Melayu, abad ke-20"]"):::src
  V("["objek ayat<br/>.arabic + .malay"]"):::ms
  M("["surahs.json (metadata)<br/>.name_en + .name_en_translation"]"):::en

  S --> B --> V
  M -.- V
```

Setiap ayat (`/api/surah/{n}.json`, `/api/search.json`):
- **`arabic`** - teks Al-Quran asal (penuh diakritik).
- **`malay`** - terjemahan Melayu Basmeih.
- **`surah`, `ayah`, `id`** - rujukan berangka.

Setiap surah (`/api/surahs.json`, metadata sahaja):
- **`name_en`, `name_en_translation`** - transliterasi dan makna Inggeris (cth. *Al-Baqara / The Cow*). Ini **bukan** terjemahan teks ayat; ia membantu pembaca bukan-Arab/bukan-Melayu mengenal pasti surah.

Jadi segitiga "Inggeris-Arab-Bahasa Melayu" ialah: **Arab** = kitab sumber, **Melayu** = terjemahan Basmeih bagi kitab itu, **Inggeris** = metadata nama-surah. Algoritma carian beroperasi pada medan Arab dan Melayu (lihat di bawah).

> 💡 Enjin carian **tidak menterjemah** antara bahasa. Ia mencari teks Arab sedia ada dan terjemahan Melayu Basmeih sedia ada secara serentak, menggunakan peraturan lipatan agar diakritik, varian alef, dan huruf besar tidak menghalang padanan.

## Peraturan lipatan (algoritma normalisasi)

Untuk menjadikan carian memaafkan, kedua-dua Arab dan Melayu **dilipat** (dinormalisasi) sebelum perbandingan. Lipatan diaplikasikan kepada pertanyaan *dan* dikira lebih awal untuk setiap ayat sekali semasa muat halaman ("cermin lipat-sekali"). Kodnya ada di [`app.js`](app.js).

### Lipatan Arab - `foldAr()`

Tiga langkah, dimodelkan selepas `ArabicNormalizer` Lucene:

```js
// 1. pemalar
const DIAC = /[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/g;          // tatweel + tashkeel + tanda Quran
const FOLD = { '\u0622':'\u0627','\u0623':'\u0627','\u0625':'\u0627','\u0671':'\u0627','\u0629':'\u0647','\u0649':'\u064A' };
const AR_FOLD_RE = /[\u0622\u0623\u0625\u0671\u0629\u0649]/g;

// 2. lipat: huruf varian -&gt; asas, kemudian tanggalkan diakritik
const foldAr = (s) => s.replace(AR_FOLD_RE, (c) => FOLD[c]).replace(DIAC, '');
```

| Peraturan | Kesan | Contoh |
| --- | --- | --- |
| Tanggalkan tatweel/tashkeel/tanda Quran | membuang `ـ` (kashida), harakat (fatha/kasra/damma), syaddah, sukun, wasla, tanda anotasi Quran | `بِسْمِ` -> `بسم` |
| Normalisasi varian alef -> ا | `آ أ إ ٱ` semuanya menjadi `ا` | `ٱللَّهِ` -> `الله` |
| Normalisasi tā' marbūṭah -> ه | `ة` menjadi `ه` | `سورة` -> `سوره` |
| Normalisasi alef maqṣūra -> ي | `ى` menjadi `ي` | `موسى` -> `موسي` |

**Hasil:** menaip **الله** memadan بِسْمِ ٱللَّهِ (diakritik + alef wasla diabaikan).

### Lipatan Melayu / Latin - `foldMs()`

```js
const foldMs = (s) => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
```

| Peraturan | Kesan | Contoh |
| --- | --- | --- |
| Penguraian NFD | mengasingkan huruf beraksen kepada asas + tanda bergabung | `é` -> `e` + `´` |
| Tanggalkan tanda bergabung (`U+0300-036F`) | membuang diakritik bergabung | `é` -> `e` |
| Huruf kecil | pemadanan peka huruf besar&kecil | `BERIMAN` -> `beriman` |

**Hasil:** menaip **BERIMAN** memadan "beriman". Teks Melayu tulen jarang membawa aksen, tetapi ini juga meliputi mana-mana edisi skrip-Latin dan diakritik kata pinjaman.

> **Had diketahui:** `foldMs` **tidak** mengendalikan normalisasi digraf Melayu (cth. *ch* -> *c*, *nj*, *sy*, *kh* secara historis) atau pemetaan sinonim (*solat* <-> *sembahyang*). Ia menormalisasi aksara, bukan perbendaharaan kata - lihat [Terminologi Melayu](#terminologi-melayu--standardisasi).

## Semua peraturan pemadanan

Diberi pertanyaan, enjin carian (`search(terms)` dalam `app.js`) mengaplikasikan peraturan ini, mengikut tertib ini:

1. **Tokenisasi** - pertanyaan diasingkan pada ruang putih menjadi terma.
2. **Lipat setiap terma** - setiap terma dilipat dengan **kedua-dua** `foldAr` dan `foldMs` (jadi kotak yang sama mengendalikan Arab dan Melayu/Inggeris).
3. **Buang terma lipat kosong** - terma yang lipat menjadi tiada (cth. diakritik tunggal) dibuang, tidak dipadan-terhadap-semua.
4. **AND antara terma** - bagi pertanyaan pelbagai perkataan, **setiap** terma mesti dipadan (di mana sahaja dalam medan Arab+Melayu gabungan). *Contoh disahkan:* `pemurah langit` -> **3** ayat.
5. **OR dalam terma antara medan** - terma dipadan jika ia muncul dalam Arab terlipat **atau** Melayu terlipat. Satu kotak carian, kedua-dua bahasa, tiada togel.
6. **Subtali dalam perkataan** - pemadanan adalah subtali (`contains`), bukan perkataan-penuh dan bukan awalan-sahaja. `rahmat` juga memadan dalam "pemurah".
7. **Tertib id-global** - hasil dipulangkan dalam `id` menaik (1-6236), tertib Quran semula jadi, tidak pernah diperingkat-kepentingan.
8. **Paparan terhad** - UI memaparkan 100 pertama dengan kawalan "Tunjukkan lagi"; API memulangkan set penuh, tidak berperingkat.

## Algoritma dalam proses carian

```mermaid
flowchart TB
  classDef load   fill:#2C1A10,stroke:#CA8A04,color:#F5E6D3
  classDef fold   fill:#581C87,stroke:#CA8A04,color:#F5E6D3
  classDef match  fill:#991B1B,stroke:#CA8A04,color:#F5E6D3
  classDef hl     fill:#3D2618,stroke:#CA8A04,color:#F5E6D3

  L("["loadIndex()<br/>fetch api/search.json"]"):::load
  M("["bina cermin SEKALI (~240ms)<br/>foldAr + foldMs per ayat"]"):::fold
  Q("["pengguna menaip<br/>debounce 250ms"]"):::load
  F("["lipat pertanyaan<br/>foldAr() + foldMs()"]"):::fold
  S("["search(terms)<br/>AND antara terma, OR antara medan<br/>subtali, tertib id"]"):::match
  H("["serlah padanan<br/>regex sedar-lipat pada teks ASAL<br/>laluan tunggal, createElement"]"):::hl
  O("["kad ayat<br/>Arab RTL atas, Melayu LTR bawah"]"):::hl

  L --> M
  Q --> F --> S
  M -. "dicari terhadap" .-> S
  S --> H --> O
```

1. **Cermin lipat-sekali.** Keseluruhan indeks 6,236 ayat dilipat **sekali** semasa muat halaman (~240 ms, di sebalik penunjuk memuat) menjadi tatasusunan selari rentetan terlipat `{ar, ms}`. Setiap ketukan kekunci kemudian mengimbas cermin, bukan teks mentah - sebab itulah carian terasa segera (~2.6 ms/ketukan).

2. **Serlahan regex sedar-lipat.** Teks ayat **asal** yang penuh diakritik dipaparkan. Untuk menyerlah padanan ke atasnya, enjin membina regex daripada pertanyaan terlipat: setiap aksara asas dikembangkan menjadi kelas aksara (varian alef, ة/ه, ى/ي) yang disambung dengan kelas elaan diakritik. Regex dijalankan terhadap teks asal, jadi serlahan mendarat pada glif yang betul walaupun ia membawa tashkeel. Diakritik mengekor selepas padanan diserap ke dalam rentang yang diserlah.

3. **"Mungkin maksud anda?" kabur (Levenshtein berjalur).** Apabila carian tidak memulangkan apa-apa, jarak **Levenshtein berjalur** (`levAtMost` dalam `app.js`) dijalankan ke atas indeks perkataan yang dibina secara malas, dibahagikan mengikut aksara pertama + panjang. Ambang ialah <=1 edit bagi perkataan pendek, <=2 bagi yang lebih panjang. Ia mencadangkan sehingga 5 alternatif *"Mungkin maksud anda:"*, jadi taipan satu- atau dua-huruf masih menemui perkataan sebenar.

4. **Pemaparan selamat XSS.** Setiap kad hasil dibina dengan `createElement` + `textContent` + `setAttribute` - **sifar `innerHTML`** (`grep -c innerHTML app.js` memulangkan 0). Pertanyaan yang direka tidak boleh menyuntik HTML, kerana teks pertanyaan tidak pernah dihuraikan sebagai HTML.

## Ketepatan terjemahan vs tafsir

Dua istilah yang penting bagi sesiapa yang menilai set data ini:

- **Terjemahan** (*terjemahan*) membariskan *makna* Arab ke dalam Melayu, berhasrat setia kepada sumber.
- **Tafsir** (*tafsir*) ialah **eksegesis** - ia menerangkan makna, selalunya menggunakan ilmu Al-Quran (`asbāb al-nuzul`, nahu, fekah, hadith, dll.) dan mungkin memparafrasa atau mengembangkan berbanding menterjemah perkataan-demi-perkataan.

***Tafsir Pimpinan Ar-Rahman* adalah, walaupun ada perkataan *tafsir* dalam tajuknya, digunakan secara meluas sebagai terjemahan Melayu** - ia agak mudah diakses dan bersifat penerangan berbanding komentar ilmiah yang padat. Inilah sebab ia menjadi pilihan standard bagi pembaca Melayu dan sebab projek ini mempertontonkannya sebagai medan `malay`. Tetapi kerana ia bersifat penerangan:

- **Sesetengah ayat dibaca sebagai tafsiran/parafrasa, bukan terjemahan harfiah.** Ini ciri bagi kebolehbacaan, bukan cacat.
- **Bagi perkara undang-undang/teologi** (*aḥkām*, fekah), pembaca perlu rujuk Arab sumber dan ilmuan yang berkelayakan, tidak bergantung pada satu terjemahan sahaja.
- **Maka "ketepatan" adalah berlapis:** kesetiaan linguistik kepada Arab, kebolehbacaan dalam Melayu, dan kewibawaan teologi adalah kebimbangan yang berkaitan tetapi berbeza. Projek ini memperlakukan Basmeih sebagai terjemahan rujukan kepercayaan-tinggi; ia tidak mengesahkan mana-mana bacaan sebagai muktamad.

Algoritma lipatan/carian **agnostik terhadap makna** - ia mencari rentetan. Padanan bermakna subtali terlipat berlaku dalam teks terlipat, tiada lebih. Sama ada ayat yang dipadan benar-benar membincangkan hasrat pencari atau tidak adalah soalan bagi pembaca (dan gurunya), bukan enjin carian.

Jika anda seorang `ālim`, ustaz/ustazah, akademik, atau pengulas DBP dan terjumpa tempat di mana teks Basmeih seperti yang dipertontonkan di sini menyimpang daripada mushaf bercetak yang disahkan atau rendering yang lebih baik, sila laporkan - lihat [CONTRIBUTING.md](CONTRIBUTING.md).
