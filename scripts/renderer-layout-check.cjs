// Development-only offscreen rendering test. Never controls a user window.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const server = spawn(process.execPath, [path.join(__dirname,'renderer-preview-server.js')], {
  env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PREVIEW_PORT:'4194'}, windowsHide:true, stdio:'ignore'
});
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:460,height:690,useContentSize:true,show:false,frame:false,webPreferences:{offscreen:true,sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const errors=[];win.webContents.on('console-message',(_e,details)=>{if(details.level==='error'||details.level===3) { errors.push(details.message); console.log('RENDER_ERROR',details.message); }});
  const results=[];
  try {
    await wait(600);
    for(const lang of ['zh','en']) {
      const scenario=process.argv.includes('--edge-cases')?'fiveHour=0&reserve=0&tasks=2&completed=1&credits=9&offline=1&pending=1&stale=1&bg=1':'fiveHour=1&reserve=1&tasks=2&completed=1';
      await win.loadURL(`http://127.0.0.1:4194/?fixed=1&lang=${lang}&${scenario}`);
      await wait(450);
      const liveChecks=await win.webContents.executeJavaScript(`(() => {
        const base=latestSnapshot.activeTasks;
        const parent={...base.tasks[0],id:'live-parent',startedAt:Math.floor(Date.now()/1000)-2000,telemetry:{totalTokens:100,outputTokens:20,partial:false}};
        const child={...base.tasks[1],id:'live-child',taskKind:'subagent'};
        renderActiveTasks({...base,latestTask:{...parent,id:'finished-child',startedAt:parent.startedAt+100,endedAt:parent.startedAt+200},tasks:[]});
        renderActiveTasks({...base,latestTask:parent,tasks:[parent,child]});
        const checks={liveParent:latestPerformanceTask.id==='live-parent',count:elements.taskConcurrency.textContent.includes('2'),subagent:elements.taskConcurrency.title.includes('1')};
        renderActiveTasks({...base,latestTask:{...parent,telemetry:{...parent.telemetry,totalTokens:200}},tasks:[parent,child]});
        checks.tokens=elements.latestTaskTokens.title==='200 Tokens';
        renderActiveTasks({...base,tasks:[],available:false});
        checks.unavailable=elements.taskConcurrency.textContent.includes('—');
        renderActiveTasks({...base,tasks:[],available:true});
        checks.stopped=elements.taskConcurrency.textContent.includes('0')&&!elements.taskConcurrency.classList.contains('is-running');
        renderActiveTasks({...base,tasks:[parent,child],truncated:true});
        checks.partial=elements.taskConcurrency.textContent.includes('≥2');
        renderActiveTasks(base);
        return checks;
      })()`);
      console.log(JSON.stringify({lang,liveChecks}));
      if(Object.values(liveChecks).some(value=>!value))throw new Error('Live task rendering regression');
      await win.webContents.executeJavaScript(`
        for (const task of activeTasks) { task.goalStatus='active'; task.goalTokensUsed=56789012; task.goalTimeUsedSeconds=86500; task.goalTokenBudget=100000000; }
        activeTasks[0].taskKind='subagent';
        if(!${process.argv.includes('--showcase')}) activeTasks[0].projectName='long-project-name-with-many-segments-and-no-spaces';
        renderActiveTasks({...latestSnapshot.activeTasks,tasks:activeTasks});
        renderMonitorUpdate({status:'ready',currentVersion:'1.3.0-beta.1',version:'1.3.0-beta.12345',percent:100});
      `);
      for(const view of ['main','tasks','cost','settings','probability','reset','updates','subscription','connection']) {
        await win.webContents.executeJavaScript(`
          for(const modal of document.querySelectorAll('[role="dialog"]')) modal.hidden=true;
          elements.settingsPopover.hidden=true;
          if('${view}'==='tasks') openActiveTasks();
          if('${view}'==='cost') openTokenCost();
          if('${view}'==='settings') elements.settingsPopover.hidden=false;
          if('${view}'==='reset') openResetCredits();
          if('${view}'==='updates') openClientUpdateHistory();
          if('${view}'==='subscription') openSubscription();
          if('${view}'==='connection') openConnectionStatus();
          if('${view}'==='probability') { renderCheckpoints(latestSnapshot); openSecondaryModal(elements.resetProbabilityModal,elements.resetProbabilityClose); }
        `);
        await wait(1000); // Include the last staggered row's bounded entrance.
        const measurements=await win.webContents.executeJavaScript(`(() => {
          const clipped=[];
          const preview = [...document.querySelectorAll('.active-task-preview-identity strong')].map(e=>({text:e.textContent,height:e.clientHeight,scroll:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth,lineHeight:getComputedStyle(e).lineHeight,decoration:getComputedStyle(e).textDecorationLine,rows:getComputedStyle(e.parentElement).gridTemplateRows}));
          const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden]');};
          for(const e of document.querySelectorAll('strong,small,span,p,h1,h2,h3,button,.quota-reset')) {
            if(!visible(e)||e.children.length||!e.textContent.trim())continue;
            const s=getComputedStyle(e);
            if(e.clientWidth>0&&e.scrollWidth>e.clientWidth+2&&!['auto','scroll'].includes(s.overflowX))clipped.push({id:e.id||e.className,text:e.textContent.slice(0,90),axis:'x',client:e.clientWidth,scroll:e.scrollWidth});
            if(e.clientHeight>0&&e.scrollHeight>e.clientHeight+2&&!['auto','scroll'].includes(s.overflowY))clipped.push({id:e.id||e.className,text:e.textContent.slice(0,90),axis:'y',client:e.clientHeight,scroll:e.scrollHeight});
            const rect=e.getBoundingClientRect();
            for(let parent=e.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
              const ps=getComputedStyle(parent),pr=parent.getBoundingClientRect();
              if(['auto','scroll'].includes(ps.overflowY))break;
              if(ps.overflowY==='hidden'&&rect.bottom>pr.bottom+2){clipped.push({id:e.id||e.className,text:e.textContent.slice(0,90),axis:'ancestor-y',parent:parent.className,bottom:rect.bottom,parentBottom:pr.bottom});break;}
            }
          }
          const footer=document.querySelector('footer').getBoundingClientRect();
          const overview=elements.taskPerformance.getBoundingClientRect();
          const overviewRow=document.querySelector('.overview-grid').getBoundingClientRect();
          for(const panel of [elements.taskPerformance,elements.quotaSection])if(panel.getBoundingClientRect().bottom>overviewRow.bottom+2)clipped.push({id:panel.id,axis:'row-overlap'});
          for(const card of document.querySelectorAll('.task-performance,.quota-section,.status-card,.active-task-card,.token-overview')){
            const cr=card.getBoundingClientRect();
            for(const leaf of card.querySelectorAll('strong,small,.quota-reset')){
              if(visible(leaf)&&leaf.getBoundingClientRect().bottom>cr.bottom+2&&!leaf.closest('.active-task-preview-row'))clipped.push({id:leaf.id||leaf.className,axis:'card-overflow'});
            }
          }
          return {clipped,footerBottom:footer.bottom,overviewBottom:overview.bottom,preview};
        })()`);
        results.push({lang,view,...measurements});
        if(['main','tasks','cost','settings'].includes(view))fs.writeFileSync(path.join(root,'release',`preview-${lang}-${view}${process.argv.includes('--edge-cases')?'-edge':''}.png`),(await win.webContents.capturePage()).toPNG());
      }
    }
    console.log(JSON.stringify({results,errors},null,2));
    if(errors.length||results.some(r=>r.clipped.length||r.footerBottom>690))process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
  finally{server.kill();win.destroy();app.quit();}
});
