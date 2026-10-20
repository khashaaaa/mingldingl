// A fresh 8-digit number per run (the fake WeSend proves any number with 000000).
output.phone = '99' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
