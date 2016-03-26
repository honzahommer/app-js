app = new App(function ($) {
    var data = app.get('data');

    // Check if DOM is already ready with jQuery passed as argument of App
    console.info($.isReady ? 'jQuery agree with App.js, DOM is really ready.' : 'Oh shit, something went wrong...');

    // Get data from App storage
    console.group('Data pushed to App storage... ');
    console.log(data);
    console.groupEnd();
}, jQuery);
