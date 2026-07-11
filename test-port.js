const net = require('net')
const c = net.connect(5174, '127.0.0.1', () => { console.log('connected to 5174'); c.end() })
c.on('error', e => console.log('error:', e.code, e.message))
