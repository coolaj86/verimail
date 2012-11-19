/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true undef:true unused:true*/
/*global window $ _gaq:true */
var _gaq;
(function () {
  "use strict";

  var location = window.location
    ;

  /* Google Analytics Custom Campain */
  _gaq = _gaq || [];

  function queryEmail(email) {
    // TODO regex check e-mail

    _gaq.push(['_trackEvent', 'email', 'submit', 'form-1', 1, true]);

    $('.js-verimail-container').fadeOut();
    $('.js-post-verimail').text('Sending you a message...');

    $.ajax({
        "type": "POST"
      , "url": "/verimail"
      , "data": JSON.stringify({ email: email })
      , "contentType": 'application/json; charset=UTF-8'
      , "timeout": 15 * 1000
      , "success": function (data) {
          console.log(data);
          if (data.success) {
            // TODO use CSS3 to fade out
            $('.js-post-verimail').hide();
            $('.js-post-verimail').text('Check your e-mail and click the verification link to continue. The message is from ' + data.result.from);
            $('.js-post-verimail').fadeIn();
          } else {
            $('.js-post-verimail').text('Hmmm... had some trouble sending e-mail to you... Double check your e-mail address and try again.');
            data.errors.forEach(function (err, i) {
              data.errors[i] = err.message || String(err);
            });
            $('.js-post-verimail').text(data.errors.join('<br/> '));
          }
        }
      , "error": function (err) {
          console.error(err);
          $('.js-post-verimail').hide();
          $('.js-post-verimail').text('Problem with connection, please check your internet connection and try again');
          $('.js-post-verimail').fadeIn();
        }
    });
  }

  $(function () {
    // Note: using .on will not capture form events
    $('body').delegate('form.js-verimail-query', 'submit', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      var email = $('.js-verimail-query input[name="email"]').val()
        ;

      queryEmail(email);
    });

    if ('#success' === location.hash) {
      $('.js-verimail-confirm').text("Thanks for verifying your e-mail address!");
    } else if (/#failure:/.exec(location.hash)) {
      $('.js-verimail-confirm').text(location.hash.substr(9));
    }
  });

}());
