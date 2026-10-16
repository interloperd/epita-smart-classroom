const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const NM = __dirname+'/node_modules';
const OUT = process.argv[2], WAV = process.argv[3], FPS = 24;
const F = NM+'/@fontsource/montserrat/files/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport:{width:1600,height:1000} })).newPage();
  await p.route('**/*', r => { const u=r.request().url(); const m=u.match(/three@0\.160\.0\/(.*)$/); if (m) return r.fulfill({ path: NM+'/three/'+m[1], contentType:'application/javascript' });
    if (u.startsWith('https://fonts.googleapis.com')) return r.fulfill({ contentType:'text/css', body: [200,300,500,600].map(w=>`@font-face{font-family:Montserrat;font-weight:${w};src:url(https://fonts.gstatic.com/m${w}.woff2)}`).join('') });
    const fm=u.match(/fonts\.gstatic\.com\/m(\d+)\.woff2/); if (fm) return r.fulfill({ path: F+`montserrat-latin-${fm[1]}-normal.woff2`, contentType:'font/woff2' });
    return u.startsWith('http://localhost')?r.continue():r.abort(); });
  await p.goto('http://localhost:8765/?tuto=0'); await p.evaluate(() => { document.getElementById('filmRoot').hidden = false; window.__filmLoaded = true; return import('./film.js'); }); await p.waitForFunction(()=>window.__FILM__,null,{timeout:60000});
  await p.evaluate(()=>{ __FILM__.pause(); });
  const total = await p.evaluate(()=>__FILM__.TOTAL); const n = Math.round(total * FPS);
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-i',WAV,'-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart', OUT], { stdio: ['pipe','inherit','inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const data = await p.evaluate((t) => { __FILM__.renderAt(t); return __FILM__.canvas.toDataURL('image/jpeg', 0.93).split(',')[1]; }, i / FPS);
    if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 240 === 0) console.log(`frame ${i}/${n} · ${Math.round((Date.now()-t0)/1000)} s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  // affiche (poster) : chapitre 1 à 2,8 s
  const poster = await p.evaluate(() => { __FILM__.renderAt(2.8); return __FILM__.canvas.toDataURL('image/jpeg', 0.88).split(',')[1]; });
  require('fs').writeFileSync(OUT.replace(/\.mp4$/, '-poster.jpg'), Buffer.from(poster, 'base64'));
  console.log('done', Math.round((Date.now()-t0)/1000), 's'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
