import { tools } from './tools.mjs';
const root=document.querySelector('[data-tool]'); const slug=root.dataset.tool; const fn=tools[slug];
const input=document.querySelector('textarea'); const output=document.querySelector('pre');
document.querySelector('[data-run]').addEventListener('click',()=>{try{output.textContent=JSON.stringify(fn(JSON.parse(input.value)),null,2)}catch(e){output.textContent=JSON.stringify({valid:false,errors:[{path:'input',code:'invalid_json',message:e.message}]},null,2)}});
document.querySelector('[data-example]').addEventListener('click',()=>{input.value=document.querySelector('script[type="application/json"]').textContent.trim();document.querySelector('[data-run]').click()});
