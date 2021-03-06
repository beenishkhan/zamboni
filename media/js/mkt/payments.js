(function() {

    var overlay = $('#pay'),
        paymentsTemplate = template($('#pay-template').html()),
        product,
        purchaseInProgress = true,
        $def,
        message = $('#purchased'),
        messageTemplate = template(message.html());

    function beginPurchase(prod) {
        if ($def && $def.state() == 'pending') {
            $def.reject(product, 'collision');
            return;
        }
        $def = $.Deferred();
        product = prod;

        // If the user is pre-authed, just call PayPal right away.
        if (z.pre_auth) {
            startPayment();
            return $def.promise();
        }

        overlay.html(paymentsTemplate(product));
        overlay.addClass('show');
        $(window).bind('keypress.payments', function(e) {
            if (e.keyCode == z.keys.ESCAPE) {
                cancelPurchase();
            }
        }).bind('overlay_dismissed', function(e) {
            cancelPurchase();
        });

        overlay.on('click.payments', '#pre-approval', beginPreApproval);
        overlay.on('click.payments', '#payment-confirm', startPayment);
        overlay.on('click.payments', '#pay .close', cancelPurchase);

        return $def.promise();
    }

    function beginPreApproval(e) {
        localStorage.setItem('toInstall', product.manifestUrl);
    }

    function cancelPurchase(e) {
        if (e && e.preventDefault) e.preventDefault();
        $def.reject(product, 'cancelled');
        $(window).unbind('.payments');
        overlay.unbind('.payments');
        overlay.removeClass('show');
    }

    function completePurchase() {
        $(window).unbind('.payments');
        overlay.unbind('.payments');
        overlay.removeClass('show');
        message.html(messageTemplate(product));
        message.toggle();
        $def.resolve(product);
    }

    function startPayment(e) {
        if (e && e.preventDefault) e.preventDefault();
        $.when(doPaypal(product))
         .then(completePurchase);
    }

    function doPaypal() {
        var $def = $.Deferred();
        $(window).bind('purchasecomplete.payments',function() {
            $def.resolve();
        });

        $(window).bind('purchaseerror.payments', function(e, p, error) {
            $('#pay-error').show().find('div').text(error);
            cancelPurchase();
        });

        $.post(product.purchase, function(response) {
            if (response.error) {
                $(window).trigger('purchaseerror', [product, response.error]);
            }
            else if (response.status == 'COMPLETED') {
                // If the response from pre-auth was good,
                // then just jump to the next step.
                $def.resolve();
            } else {
                // This will show if the user is not pre-authed
                // or for some reason the pre-auth failed.
                dgFlow = new PAYPAL.apps.DGFlow({trigger: '#page'});
                dgFlow.startFlow(response.url);
                overlay.removeClass('show');
                // Scroll to top of PayPal modal.
                var offset = $('iframe[name=PPDGFrame]').offset().top;
                if (offset > 9) {
                    $(document.documentElement).animate({scrollTop: offset}, 1000);
                }
                // When PayPal modal gets dismissed, reset install button.
                var intVal = setInterval(function() {
                    if (!dgFlow.isOpen()) {
                        clearInterval(intVal);
                        cancelPurchase();
                        return;
                    }
                }, 1000);
            }
        });
        return $def.promise();
    }

    z.payments = {
        'purchase': beginPurchase
    };
})();
