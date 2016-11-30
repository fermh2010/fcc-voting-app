module.exports = function() {
  const headers = document.getElementsByClassName('header');
  for(let i = 0; i < headers.length; ++i) {
    const header = headers.item(i);
    const loginButton = header.querySelector('#login-button');
    loginButton.addEventListener('click', function(event) {
      console.log('TODO: login clicked');
    });
  }
};
