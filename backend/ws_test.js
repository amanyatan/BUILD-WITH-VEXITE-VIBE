const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:4000/ws/conversation');
let timeout = setTimeout(() => { console.log('TIMEOUT'); ws.close(); process.exit(1); }, 60000);
ws.on('open', () => { ws.send(JSON.stringify({ type: 'start_session', projectId: 'test-code-gen' })); });
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(msg.type, msg.text ? msg.text.substring(0, 120) : '', msg.audio ? 'audio=' + msg.audio.length : '', msg.event ? msg.event.type : '');
  if (msg.type === 'live_ready') { ws.send(JSON.stringify({ type: 'text_message', text: 'Build a tic tac toe game for me' })); }
  if (msg.type === 'audio_response') { console.log('GOT AUDIO!'); }
  if (msg.type === 'audio_error') { console.log('TTS ERROR:', msg.message); }
  if (msg.type === 'error') { console.log('ERROR:', msg.message); }
});
ws.on('error', (e) => { console.log('WS ERROR:', e.message); });
