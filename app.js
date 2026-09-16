(() => {
  const KOTA_ID = '1108'; // KOTA TANGERANG SELATAN
  const IQOMAH_DURASI = { subuh: 15*60, dzuhur: 10*60, ashar: 10*60, maghrib: 10*60, isya: 10*60 };
  const LURUSKAN_DURASI = 90; // detik tampil "LURUSKAN..." setelah iqomah 0

  const els = {
    jam: document.getElementById('jamDigital'),
    jamMobile: document.getElementById('jamDigitalMobile'),
    hariTanggal: document.getElementById('hariTanggal'),
    hariTanggalMobile: document.getElementById('hariTanggalMobile'),
    tanggalFull: document.getElementById('tanggalFull'),
    hadisTitle: document.getElementById('hadisTitle'),
    hadisText: document.getElementById('hadisText'),
    hadisArab: document.getElementById('hadisArab'),
    hadisGrade: document.getElementById('hadisGrade'),
    hadisAttribution: document.getElementById('hadisAttribution'),
    hadisSource: document.getElementById('hadisSource'),
    hadisCounter: document.getElementById('hadisCounter'),
    hadisCard: document.getElementById('hadisCard'),
    progressBar: document.getElementById('progressBar'),
    nextIn: document.getElementById('nextIn'),
    jadwalGrid: document.getElementById('jadwalGrid'),
    jadwalTanggal: document.getElementById('jadwalTanggal'),
    jadwalLokasi: document.getElementById('jadwalLokasi'),
    nextPrayerInfo: document.getElementById('nextPrayerInfo'),
    iqomahOverlay: document.getElementById('iqomahOverlay'),
    iqomahState: document.getElementById('iqomahState'),
    luruskanState: document.getElementById('luruskanState'),
    iqomahName: document.getElementById('iqomahName'),
    iqomahCountdown: document.getElementById('iqomahCountdown'),
    luruskanTimer: document.getElementById('luruskanTimer'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMsg'),
  };

  let jadwalHariIni = null;
  let hadisListCache = [];
  let hadisIndex = 0;
  let hadisInterval = null;
  let detikMenujuGanti = 10;

  // Iqomah state
  let activeIqomah = null; // { name, key, startTime: Date, endTime: Date }
  let luruskanUntil = null;
  let lastPrayerKeyHandled = null;

  const PRAYERS = [
    { key: 'subuh', label: 'SUBUH', icon: '🌙' },
    { key: 'dzuhur', label: 'DZUHUR', icon: '☀️' },
    { key: 'ashar', label: 'ASHAR', icon: '🌤️' },
    { key: 'maghrib', label: 'MAGHRIB', icon: '🌅' },
    { key: 'isya', label: 'ISYA', icon: '🌃' },
  ];

  const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  const FALLBACK_HADIS = [
    { title: "Sesungguhnya amalan itu tergantung niatnya", hadis: "Dari Umar bin Khattab radhiyallahu 'anhu, Rasulullah ﷺ bersabda: 'Sesungguhnya setiap amalan tergantung pada niatnya. Dan setiap orang akan mendapatkan apa yang ia niatkan.'", grade: "Hadis sahih", attribution: "HR. Bukhari & Muslim", arab: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ" },
    { title: "Senyummu di hadapan saudaramu adalah sedekah", hadis: "Rasulullah ﷺ bersabda: 'Senyummu di hadapan saudaramu adalah sedekah, amar ma'ruf nahi mungkar adalah sedekah.'", grade: "Hadis hasan", attribution: "HR. Tirmidzi", arab: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ" },
    { title: "Kebersihan adalah sebagian dari iman", hadis: "Rasulullah ﷺ bersabda: 'Kebersihan adalah sebagian dari iman.' Jagalah kebersihan diri, pakaian, dan lingkungan.", grade: "Hadis sahih", attribution: "HR. Muslim", arab: "الطُّهُورُ شَطْرُ الإِيمَانِ" },
    { title: "Orang yang paling baik adalah yang paling bermanfaat", hadis: "Rasulullah ﷺ bersabda: 'Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lain.'", grade: "Hadis hasan", attribution: "HR. Ahmad", arab: "خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ" },
    { title: "Jangan marah, bagimu surga", hadis: "Seorang sahabat meminta nasihat kepada Rasulullah ﷺ, beliau bersabda: 'Jangan marah.' Beliau mengulanginya beberapa kali: 'Jangan marah.'", grade: "Hadis sahih", attribution: "HR. Bukhari", arab: "لَا تَغْضَبْ وَلَكَ الْجَنَّةُ" },
    { title: "Mudahkanlah, jangan persulit", hadis: "Rasulullah ﷺ bersabda: 'Mudahkanlah dan jangan mempersulit, berilah kabar gembira dan jangan membuat orang lari.'", grade: "Hadis sahih", attribution: "HR. Bukhari & Muslim", arab: "يَسِّرُوا وَلَا تُعَسِّرُوا" },
  ];

  function showToast(msg, ms=3200){
    els.toastMsg.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> els.toast.classList.add('hidden'), ms);
  }

  function formatJam(date){
    // format HH:MM agar sesuai layout-example.jpg (tanpa detik, WIB ditambah via HTML)
    return date.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', hour12:false });
  }
  function formatTanggalPanjang(date){
    return `${HARI_ID[date.getDay()]}, ${date.getDate()} ${BULAN_ID[date.getMonth()]} ${date.getFullYear()}`;
  }

  function parseJadwalTime(str, baseDate){
    // str "04:32"
    const [h,m] = str.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d;
  }

  async function fetchJadwal(){
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,'0');
    const d = String(now.getDate()).padStart(2,'0');
    const url = `https://api.myquran.com/v2/sholat/jadwal/${KOTA_ID}/${y}/${m}/${d}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const json = await res.json();
      if(!json.status || !json.data?.jadwal) throw new Error('format jadwal invalid');
      jadwalHariIni = json.data;
      renderJadwal();
    } catch(e){
      console.warn('jadwal fetch gagal', e);
      showToast('Jadwal sholat gagal dimuat, coba offline');
      // fallback jadwal dummy hari ini agar iqomah tetap logis
      if(!jadwalHariIni){
        jadwalHariIni = {
          lokasi: 'KOTA TANGERANG SELATAN',
          daerah: 'BANTEN',
          jadwal: { tanggal: formatTanggalPanjang(now), subuh:'04:32', dzuhur:'11:52', ashar:'15:05', maghrib:'17:54', isya:'19:02', date: `${y}-${m}-${d}` }
        };
        renderJadwal();
      }
    }
  }

  function renderJadwal(){
    if(!jadwalHariIni) return;
    const j = jadwalHariIni.jadwal;
    els.jadwalTanggal.textContent = j.tanggal || j.date;
    els.jadwalLokasi.textContent = (jadwalHariIni.lokasi || 'TANGERANG SELATAN').toUpperCase();
    els.jadwalGrid.innerHTML = '';
    PRAYERS.forEach(p => {
      const time = j[p.key] || '--:--';
      const card = document.createElement('div');
      card.id = `prayer-${p.key}`;
      card.className = 'rounded-xl lg:rounded-2xl px-2 lg:px-3 py-2.5 lg:py-3 text-center bg-white/90 backdrop-blur shadow-md border border-white/50 transition-all duration-300';
      card.innerHTML = `
        <p class="text-[10px] lg:text-[11px] font-black tracking-[0.14em] text-emerald-900/70">${p.label}</p>
        <p class="text-[10px] leading-none mt-0.5">${p.icon}</p>
        <p class="font-black text-emerald-950 text-[15px] lg:text-xl leading-none mt-1 tabular-nums">${time}</p>
        <p class="text-[9px] lg:text-[10px] font-bold text-emerald-700/50 mt-1 tracking-widest">WIB</p>
      `;
      els.jadwalGrid.appendChild(card);
    });
    updateNextPrayerHighlight();
  }

  function updateNextPrayerHighlight(){
    if(!jadwalHariIni) return;
    const now = new Date();
    const j = jadwalHariIni.jadwal;
    let next = null;
    let nextDiff = Infinity;

    PRAYERS.forEach(p => {
      const t = parseJadwalTime(j[p.key], now);
      const diff = t - now;
      const el = document.getElementById(`prayer-${p.key}`);
      if(!el) return;
      el.classList.remove('prayer-active','prayer-next','opacity-60');
      // reset inline
      if(diff > 0 && diff < nextDiff){
        nextDiff = diff;
        next = { key: p.key, label: p.label, time: j[p.key], diff };
      }
    });

    // highlight next
    if(next){
      const el = document.getElementById(`prayer-${next.key}`);
      if(el) el.classList.add('prayer-next');
      const jam = Math.floor(next.diff/3600000);
      const men = Math.floor((next.diff%3600000)/60000);
      els.nextPrayerInfo.textContent = `Menuju ${next.label} ${next.time} • ${jam>0? jam+'j ':''}${men}m lagi`;
    } else {
      // sudah lewat isya
      els.nextPrayerInfo.textContent = `Menuju SUBUH besok • ${j.subuh}`;
      // highlight subuh as next tomorrow subtle
      const el = document.getElementById('prayer-subuh');
      if(el) el.classList.add('opacity-60');
    }

    // if iqomah active, highlight active
    if(activeIqomah){
      const el = document.getElementById(`prayer-${activeIqomah.key}`);
      if(el){ el.classList.remove('prayer-next'); el.classList.add('prayer-active'); }
    }
  }

  async function fetchHadisRandom(){
    // coba 2 endpoint, fallback ke cache lokal
    const endpoints = [
      //'https://api.myquran.com/v2/hadits/koleksi/acak',
      'https://api.myquran.com/v2/hadits/koleksi/random'
    ];
    for(const url of endpoints){
      try{
        const res = await fetch(url, { cache: 'no-store' });
        if(!res.ok) continue;
        const json = await res.json();
        if(json.status && json.data){
          const d = json.data;
          return {
            title: d.title || 'Hadis Pilihan',
            hadis: (d.idn && d.idn.hadis) ? d.idn.hadis : d.title,
            grade: (d.idn && d.idn.grade) ? d.idn.grade : 'Hadis',
            attribution: (d.idn && d.idn.attribution) ? d.idn.attribution : 'MyQuran',
            arab: (d.ar && d.ar.hadis) ? d.ar.hadis : '',
            source: `No. ${d.id || '-'} • MyQuran`
          };
        }
      }catch(e){ /* lanjut */ }
    }
    // fallback
    const f = FALLBACK_HADIS[Math.floor(Math.random()*FALLBACK_HADIS.length)];
    return { title: f.title, hadis: f.hadis, grade: f.grade, attribution: f.attribution, arab: f.arab, source: f.attribution };
  }

  function renderHadis(h){
    // animasi exit-enter sederhana - hanya terjemahan Indonesia, tanpa arab
    els.hadisCard.style.opacity = '0';
    els.hadisCard.style.transform = 'translateY(8px) scale(0.98)';
    els.hadisCard.style.transition = 'all 220ms ease';
    setTimeout(()=>{
      els.hadisTitle.textContent = h.title || 'Hadis';
      //els.hadisText.textContent = h.hadis || h.title;
      els.hadisGrade.textContent = h.grade || 'Hadis';
      els.hadisAttribution.textContent = h.attribution ? `— ${h.attribution}` : '— MyQuran';
      els.hadisSource.textContent = h.source || 'MyQuran';
      // selalu sembunyikan arab sesuai permintaan - hanya terjemahan ID
      if(els.hadisArab){
        els.hadisArab.textContent = '';
        els.hadisArab.classList.add('hidden');
      }
      els.hadisCard.style.opacity = '1';
      els.hadisCard.style.transform = 'translateY(0) scale(1)';
    }, 220);
    hadisIndex++;
    if(els.hadisCounter) els.hadisCounter.textContent = `${hadisIndex} • acak`;
  }

  async function rotateHadis(){
    const h = await fetchHadisRandom();
    renderHadis(h);
  }

  function startHadisRotation(){
    rotateHadis();
    detikMenujuGanti = 15;
    els.nextIn.textContent = '15s';
    els.progressBar.style.animation = 'none';
    // trigger reflow
    void els.progressBar.offsetWidth;
    els.progressBar.style.animation = '';
    els.progressBar.classList.remove('animate-progress');
    void els.progressBar.offsetWidth;
    els.progressBar.classList.add('animate-progress');

    clearInterval(hadisInterval);
    hadisInterval = setInterval(async ()=>{
      if(activeIqomah || luruskanUntil) return; // pause saat iqomah/luruskan
      detikMenujuGanti--;
      els.nextIn.textContent = detikMenujuGanti + 's';
      if(detikMenujuGanti <= 0){
        detikMenujuGanti = 15;
        els.nextIn.textContent = '15s';
        // restart progress
        els.progressBar.classList.remove('animate-progress');
        void els.progressBar.offsetWidth;
        els.progressBar.classList.add('animate-progress');
        const h = await fetchHadisRandom();
        renderHadis(h);
      }
    }, 1000);
  }

  // IQOMAH LOGIC
  function checkIqomah(now){
    if(!jadwalHariIni) return;
    const j = jadwalHariIni.jadwal;

    // jika sedang luruskan, cek apakah sudah selesai
    if(luruskanUntil){
      const sisa = luruskanUntil - now;
      if(sisa <= 0){
        hideOverlay();
        luruskanUntil = null;
        lastPrayerKeyHandled = null; // reset agar tidak langsung retrigger? but will retrigger if masih dalam window, so delay a bit
        // prevent immediate retrigger for same prayer by marking as handled for 2 menit
        setTimeout(()=> lastPrayerKeyHandled = null, 120000);
      } else {
        els.luruskanTimer.textContent = `Otomatis kembali dalam ${Math.ceil(sisa/1000)} detik`;
      }
      return;
    }

    if(activeIqomah){
      const sisa = activeIqomah.endTime - now;
      if(sisa <= 0){
        // switch to luruskan
        activeIqomah = null;
        luruskanUntil = new Date(now.getTime() + LURUSKAN_DURASI*1000);
        showLuruskan();
        updateNextPrayerHighlight();
      } else {
        const mm = String(Math.floor(sisa/60000)).padStart(2,'0');
        const ss = String(Math.floor((sisa%60000)/1000)).padStart(2,'0');
        els.iqomahCountdown.textContent = `${mm}:${ss}`;
      }
      return;
    }

    // cek apakah ada sholat yang baru masuk dan belum di-handle
    for(const p of PRAYERS){
      const tStr = j[p.key];
      if(!tStr || tStr==='--:--') continue;
      const start = parseJadwalTime(tStr, now);
      const dur = IQOMAH_DURASI[p.key] || 600;
      const end = new Date(start.getTime() + dur*1000);
      // window: [start, end)
      if(now >= start && now < end){
        if(lastPrayerKeyHandled === p.key) return; // sudah pernah tampil hari ini untuk prayer ini dan belum reset
        // trigger iqomah
        activeIqomah = { key: p.key, name: p.label, startTime: start, endTime: end };
        lastPrayerKeyHandled = p.key;
        showIqomah(p.label, end - now);
        updateNextPrayerHighlight();
        return;
      }
    }
  }

  function showIqomah(label, sisaMs){
    els.iqomahOverlay.classList.remove('hidden');
    els.iqomahOverlay.classList.add('flex');
    els.iqomahState.classList.remove('hidden');
    els.iqomahState.classList.add('flex');
    els.luruskanState.classList.add('hidden');
    els.luruskanState.classList.remove('flex');
    els.iqomahName.textContent = label;
    const sisa = sisaMs;
    const mm = String(Math.floor(sisa/60000)).padStart(2,'0');
    const ss = String(Math.floor((sisa%60000)/1000)).padStart(2,'0');
    els.iqomahCountdown.textContent = `${mm}:${ss}`;
  }
  function showLuruskan(){
    els.iqomahState.classList.add('hidden');
    els.iqomahState.classList.remove('flex');
    els.luruskanState.classList.remove('hidden');
    els.luruskanState.classList.add('flex');
  }
  function hideOverlay(){
    els.iqomahOverlay.classList.add('hidden');
    els.iqomahOverlay.classList.remove('flex');
    activeIqomah = null;
    // reset hadis progress agar langsung fresh
    detikMenujuGanti = 10;
    els.progressBar.classList.remove('animate-progress');
    void els.progressBar.offsetWidth;
    els.progressBar.classList.add('animate-progress');
    updateNextPrayerHighlight();
  }

  function tick(){
    const now = new Date();
    const jam = formatJam(now);
    if(els.jam) els.jam.textContent = jam;
    if(els.jamMobile) els.jamMobile.textContent = jam;
    const tgl = formatTanggalPanjang(now);
    if(els.hariTanggal) els.hariTanggal.textContent = tgl;
    if(els.hariTanggalMobile) els.hariTanggalMobile.textContent = tgl;
    if(els.tanggalFull) els.tanggalFull.textContent = `${HARI_ID[now.getDay()]} • ${now.getDate()} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()} • ${jam} WIB`;

    checkIqomah(now);
    // update highlight tiap menit
    if(now.getSeconds()===0) updateNextPrayerHighlight();
  }

  // Inisialisasi
  async function init(){
    renderJadwal(); // render placeholder dulu
    await fetchJadwal();
    startHadisRotation();
    tick();
    setInterval(tick, 1000);

    // refresh jadwal tiap jam & saat ganti hari
    setInterval(fetchJadwal, 60*60*1000);

    // cegah screensaver / sleep di TV: keep awake hint
    document.addEventListener('click', ()=> {
      if(activeIqomah || luruskanUntil) hideOverlay();
    });
    // tombol keyboard untuk testing manual: tekan S subuh, D dzuhur dll
    document.addEventListener('keydown', (e)=>{
      const k = e.key.toLowerCase();
      const map = { s:'subuh', d:'dzuhur', a:'ashar', m:'maghrib', i:'isya' };
      if(map[k]){
        const dur = IQOMAH_DURASI[map[k]];
        const now = new Date();
        activeIqomah = { key: map[k], name: map[k].toUpperCase(), startTime: now, endTime: new Date(now.getTime()+ dur*1000) };
        showIqomah(map[k].toUpperCase(), dur*1000);
      }
      if(k==='escape') hideOverlay();
    });
  }

  // cek orientasi TV: tambahkan class jika portrait
  function handleOrientation(){
    if(window.matchMedia('(orientation: portrait)').matches){
      document.body.classList.add('portrait');
    } else {
      document.body.classList.remove('portrait');
    }
  }
  window.addEventListener('resize', handleOrientation);
  handleOrientation();

  init();

  // Expose untuk debug di TV browser
  window._signage = { fetchJadwal, rotateHadis, showIqomah, hideOverlay };
})();
