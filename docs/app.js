'use strict';
const $ = id => document.getElementById(id);
const reader = $('reader'), stack = $('paper-stack');
let data, active, zoom = 1, currentPage = 5, scrollTick = false;
function message(text = '') { $('message').textContent = text; $('message').hidden = !text; }
function save(value) { try { localStorage.setItem('physics-answer:last', JSON.stringify(value)); } catch {} }
function chineseNumber(word) {
 const digits = {'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
 if (word.includes('百')) return 'invalid';
 if (word.includes('十')) { const [t,u] = word.split('十'); return String((t ? digits[t] : 1)*10 + (u ? digits[u] : 0)); }
 return [...word].map(c => digits[c]).join('');
}
function parseQuery(value) {
 const text = value.normalize('NFKC').replace(/[零〇一二两三四五六七八九十百]+/g, chineseNumber);
 if (/[^\d\s第次作业题号,，、.。:：/\\—–\-]/.test(text)) return null;
 const parts = text.match(/\d+/g);
 if (!parts || parts.length !== 2) return null;
 return { assignment:Number(parts[0]), question:Number(parts[1]) };
}
function updatePicker(number) {
 $('assignment').value = String(number);
 const chapter = data.chapters.find(c => c.number === number);
 $('topic').textContent = chapter.title;
 $('question-grid').replaceChildren();
 for (let q = 1; q <= 24; q++) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = String(q);
  button.setAttribute('aria-label',`第${number}次作业 第${q}题`);
  button.setAttribute('aria-pressed',String(active?.assignment === number && active?.question === q));
  if (!data.questions.some(r => r.assignment === number && r.question === q)) button.className = 'missing';
  button.addEventListener('click',() => search(number,q));
  $('question-grid').append(button);
 }
 $('index-note').textContent = number === 12 ? '原稿未找到第18题。' : number === 13 ? '原稿有两个第23题，未标第24题。' : '收录第1～24题；补充练习不参与搜索。';
}
function pageTop(n) { const el = $(`page-${n}`); return el.getBoundingClientRect().top - reader.getBoundingClientRect().top + reader.scrollTop; }
function updatePage(n) {
 currentPage = n; $('page-select').value = String(n);
 $('prev-page').disabled = n <= 5; $('next-page').disabled = n >= 82;
}
function goPage(n) {
 if (n < 5 || n > 82) return;
 reader.scrollTop = pageTop(n); reader.scrollLeft = 0; updatePage(n);
}
function openQuestion(record, updateHistory = true) {
 active = record; message(); $('choices').hidden = true;
 $('query').value = `${record.assignment} ${record.question}`;
 updatePicker(record.assignment);
 const chapter = data.chapters.find(c => c.number === record.assignment);
 $('result-title').textContent = `第 ${record.assignment} 次作业 · 第 ${record.question} 题`;
 $('result-subtitle').textContent = `${chapter.title} / ${record.type}${record.note ? ' / '+record.note : ''}`;
 document.querySelector('.target-marker')?.remove();
 const paper = $(`page-${record.page}`), img = paper.querySelector('img');
 img.loading = 'eager';
 const marker = document.createElement('div'); marker.className = 'target-marker';
 marker.style.top = `${record.y * 100}%`; marker.setAttribute('aria-label',`第${record.question}题起始位置`); paper.append(marker);
 reader.scrollTop = pageTop(record.page) + paper.clientHeight * record.y - 24;
 reader.scrollLeft = 0; updatePage(record.page);
 save({ assignment:record.assignment, question:record.question, page:record.page });
 if (updateHistory) history.pushState(null,'',`#a=${record.assignment}&q=${record.question}&p=${record.page}`);
}
function search(assignment,question, preferredPage, updateHistory = true) {
 $('choices').hidden = true; $('choices').replaceChildren();
 if (!Number.isInteger(assignment) || !Number.isInteger(question) || assignment < 11 || assignment > 18 || question < 1 || question > 24) {
  message('请输入第11～18次作业、1～24之间的题号，例如：11 3。'); return;
 }
 updatePicker(assignment);
 const records = data.questions.filter(r => r.assignment === assignment && r.question === question);
 if (!records.length) {
  message(data.missing.find(r => r.assignment === assignment && r.question === question)?.message || '原稿未找到这道题。');
  if (assignment === 13 && question === 24) {
   const b = document.createElement('button'); b.textContent = '查看两道标为第23题的题目';
   b.addEventListener('click',() => search(13,23)); $('choices').append(b); $('choices').hidden = false;
  }
  return;
 }
 const preferred = records.find(r => r.page === preferredPage);
 if (records.length === 1 || preferred) { openQuestion(preferred || records[0],updateHistory); return; }
 message('原稿有两个第23题，请按题目内容选择：');
 for (const record of records) {
  const b = document.createElement('button');
  b.textContent = `${record.note.replace('原文重号：','')}（PDF第${record.page}页）`;
  b.addEventListener('click',() => openQuestion(record)); $('choices').append(b);
 }
 $('choices').hidden = false;
}
function changeZoom(next) {
 const ratio = reader.scrollTop / Math.max(1,stack.scrollHeight), leftRatio = reader.scrollLeft / Math.max(1,stack.scrollWidth);
 zoom = Math.min(3,Math.max(1,Number(next.toFixed(2))));
 stack.style.width = `${zoom * 100}%`;
 $('zoom-reset').textContent = `${Math.round(zoom*100)}%`;
 $('zoom-out').disabled = zoom <= 1; $('zoom-in').disabled = zoom >= 3;
 reader.scrollTop = ratio * stack.scrollHeight; reader.scrollLeft = leftRatio * stack.scrollWidth;
}
function restore() {
 const hash = new URLSearchParams(location.hash.slice(1));
 if (hash.has('a')) { search(Number(hash.get('a')),Number(hash.get('q')),Number(hash.get('p')),false); return; }
 let last; try { last = JSON.parse(localStorage.getItem('physics-answer:last')); } catch {}
 if (last && data.questions.some(r => r.assignment === last.assignment && r.question === last.question && r.page === last.page)) search(last.assignment,last.question,last.page,false);
 else openQuestion(data.questions[0],false);
}
async function init() {
 try {
  const response = await fetch('./index-data.json'); if (!response.ok) throw new Error('index'); data = await response.json();
  for (const chapter of data.chapters) { const o = document.createElement('option'); o.value = chapter.number; o.textContent = `第${chapter.number}次`; $('assignment').append(o); }
  for (let n=5;n<=82;n++) {
   const option = document.createElement('option'); option.value=n; option.textContent=String(n); $('page-select').append(option);
   const paper = document.createElement('article'); paper.className='paper'; paper.id=`page-${n}`; paper.setAttribute('aria-label',`PDF第${n}页，书内第${n-4}页`);
   const img = document.createElement('img'); img.src=`./pages/${String(n).padStart(3,'0')}.webp`; img.alt=`作业原稿：PDF第${n}页，书内第${n-4}页`; img.width=1667; img.height=2357; img.loading='lazy'; img.decoding='async';
   const error = document.createElement('div'); error.className='load-error';
   const text = document.createElement('p'); text.textContent='原页未加载。请检查网络后重试。';
   const retry = document.createElement('button'); retry.textContent='重新加载'; retry.addEventListener('click',()=>{ paper.classList.remove('failed'); img.src=`./pages/${String(n).padStart(3,'0')}.webp?retry=${Date.now()}`; });
   img.addEventListener('error',()=>paper.classList.add('failed')); img.addEventListener('load',()=>paper.classList.remove('failed'));
   error.append(text,retry); paper.append(img,error); stack.append(paper);
  }
  $('search-form').addEventListener('submit',event=>{event.preventDefault(); const parsed=parseQuery($('query').value); if (!parsed) {message('请输入作业次数和题号，例如：11 3，或第十一次作业第3题。');$('choices').hidden=true;return;} $('query').blur();search(parsed.assignment,parsed.question);});
  $('assignment').addEventListener('change',()=>updatePicker(Number($('assignment').value)));
  $('page-select').addEventListener('change',()=>goPage(Number($('page-select').value)));
  $('prev-page').addEventListener('click',()=>goPage(currentPage-1)); $('next-page').addEventListener('click',()=>goPage(currentPage+1));
  $('zoom-in').addEventListener('click',()=>changeZoom(zoom+.25)); $('zoom-out').addEventListener('click',()=>changeZoom(zoom-.25)); $('zoom-reset').addEventListener('click',()=>changeZoom(1));
  reader.addEventListener('scroll',()=>{if(scrollTick)return;scrollTick=true;requestAnimationFrame(()=>{scrollTick=false;const pos=reader.scrollTop+24;let page=5;for(let n=5;n<=82;n++){if(pageTop(n)<=pos)page=n;else break;} updatePage(page);});},{passive:true});
  window.addEventListener('hashchange',restore);
  restore(); changeZoom(1);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
 } catch { $('result-title').textContent='索引加载失败'; message('请检查网络并刷新页面，首次打开需要联网。'); }
}
$('help').addEventListener('click',()=>$('help-dialog').showModal()); $('close-help').addEventListener('click',()=>$('help-dialog').close());
function networkStatus(){document.body.classList.toggle('offline',!navigator.onLine);}
window.addEventListener('online',networkStatus);window.addEventListener('offline',networkStatus);networkStatus();init();
