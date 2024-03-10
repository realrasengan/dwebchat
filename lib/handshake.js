const KEY=require('fs').readFileSync('bob.key').toString().trim();

async function getDwc(name) {
  const response = await fetch('http://127.0.0.1:12037/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`x:${KEY}`).toString('base64')
    },
    body: JSON.stringify({ 'method':'getnameresource', 'params':[name] })
  });
  const result = await response.json();
  const records = result.result.records;
  for(let x=0;x<records.length;x++) {
    if(records[x].type==='TXT') {
      const txt = records[x].txt;
      for(let y=0;y<txt.length;y++) {
        const txtData = txt[y];
        if(txtData.substr(0,4)=='dwc=') {
          let return_string=txtData.substr(4);
          let return_obj = { 'cert':return_string.substr(0,64), 'ip':return_string.substr(64) }
          return return_obj;
        }
      }
    }
  }
  return false;
}

module.exports = getDwc;
