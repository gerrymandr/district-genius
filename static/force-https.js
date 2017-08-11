// make /login and /register happen in HTTPS
if (window.location.protocol === "http:") {
  window.location.href = 'https://district-genius.herokuapp.com' + window.location.pathname;
}
