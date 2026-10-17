// A fresh 8-digit number per run (fake verify.mn proves any number).
output.phone = '99' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
