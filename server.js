const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname), { index: false }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'hub.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Merlin Events running on port ${PORT}`));
