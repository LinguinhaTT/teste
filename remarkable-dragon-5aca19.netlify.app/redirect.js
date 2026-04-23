if (window.anubisRedirectInitialized) {
    console.warn('AnubisPay Redirect já foi inicializado, evitando execução duplicada.');
} else {
    window.anubisRedirectInitialized = true;

    // ─── Cart (localStorage) ──────────────────────────────────────────────────

    var AnubisCart = (function () {
        var KEY = 'anubis_cart';

        function getCart() {
            try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
        }

        function saveCart(items) {
            localStorage.setItem(KEY, JSON.stringify(items));
        }

        function addItem(item) {
            var items = getCart();
            var existing = items.find(function (i) { return i.id === item.id; });
            if (existing) {
                existing.quantity += (item.quantity || 1);
            } else {
                items.push({ id: item.id, name: item.name, price: item.price, image: item.image || '', quantity: item.quantity || 1 });
            }
            saveCart(items);
            return items;
        }

        function removeItem(id) {
            var items = getCart().filter(function (i) { return i.id !== id; });
            saveCart(items);
            return items;
        }

        function updateQuantity(id, quantity) {
            var items = getCart();
            var item = items.find(function (i) { return i.id === id; });
            if (item) item.quantity = Math.max(1, quantity);
            saveCart(items);
            return items;
        }

        function getTotal() {
            return getCart().reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
        }

        function getCount() {
            return getCart().reduce(function (s, i) { return s + i.quantity; }, 0);
        }

        function clearCart() { localStorage.removeItem(KEY); }

        return { getCart: getCart, addItem: addItem, removeItem: removeItem, updateQuantity: updateQuantity, getTotal: getTotal, getCount: getCount, clearCart: clearCart };
    })();

    window.AnubisCart = AnubisCart;

    var isLoadingSecureCheckout = false;

    // ─── Loader ────────────────────────────────────────────────────────────────

    function showSecureLoader() {
        isLoadingSecureCheckout = true;
        var loader = document.getElementById('checkout-secure-loader');
        if (!loader) return;
        loader.style.display = 'block';
        loader.offsetHeight;
        loader.classList.add('active');
    }

    function hideSecureLoader() {
        isLoadingSecureCheckout = false;
        var loader = document.getElementById('checkout-secure-loader');
        if (!loader) return;
        loader.classList.remove('active');
        setTimeout(function () {
            if (!isLoadingSecureCheckout) {
                var l = document.getElementById('checkout-secure-loader');
                if (l) l.style.display = 'none';
            }
        }, 300);
    }

    // ─── Product data ─────────────────────────────────────────────────────────

    function getProductData(buttonRef) {
        var name = '', price = 0, image = '', variantId = null;

        try {
            var ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) name = ogTitle.getAttribute('content');
        } catch (e) {}

        try {
            var ogImg = document.querySelector('meta[property="og:image:secure_url"]') ||
                        document.querySelector('meta[property="og:image"]');
            if (ogImg) image = ogImg.getAttribute('content');
        } catch (e) {}

        try {
            if (window.meta && window.meta.product && window.meta.product.variants) {
                var variants = window.meta.product.variants;
                var selectedId = null;

                if (buttonRef) {
                    var form = buttonRef.closest('form') || document.querySelector('form[action*="/cart/add"], form.product-form');
                    if (form) {
                        var idInput = form.querySelector('input[name="id"]');
                        if (idInput) selectedId = parseInt(idInput.value);
                    }
                }

                var variant = selectedId
                    ? variants.find(function (v) { return v.id === selectedId; })
                    : variants[0];

                if (variant) {
                    if (variant.price > 0) price = variant.price;
                    variantId = variant.id;
                }
            }
        } catch (e) {}

        if (price === 0) {
            try {
                var selectors = ['.price--highlight', '.price--sale .price--sale__amount',
                                 '.product-form__price .price', '.price:not(.price--compare)'];
                for (var i = 0; i < selectors.length; i++) {
                    var el = document.querySelector(selectors[i]);
                    if (!el) continue;
                    var text = el.textContent.replace(/[^\d,]/g, '').replace(',', '.');
                    var p = Math.round(parseFloat(text) * 100);
                    if (p > 0) { price = p; break; }
                }
            } catch (e) {}
        }

        if (!variantId) {
            try {
                var inp = document.querySelector('form[action*="/cart/add"] input[name="id"]');
                if (inp) variantId = parseInt(inp.value) || null;
            } catch (e) {}
        }

        return { id: String(variantId || name || 'product'), name: name, price: price, image: image };
    }

    // ─── Resolve relative path to cart/checkout ───────────────────────────────

    function relPath(filename) {
        var depth = (location.pathname.match(/\//g) || []).length - 1;
        return (depth > 0 ? '../'.repeat(depth) : '') + filename;
    }

    // ─── Add to cart + redirect to cart.html ─────────────────────────────────

    function addToCartAndRedirect(buttonRef) {
        var data = getProductData(buttonRef);

        if (!data.price || data.price <= 0) {
            hideSecureLoader();
            alert('Erro: não foi possível obter o preço do produto. Por favor, tente novamente.');
            return;
        }

        AnubisCart.addItem({ id: data.id, name: data.name, price: data.price, image: data.image, quantity: 1 });
        window.location.href = relPath('cart.html');
    }

    // ─── Cart page: "Finalizar compra" ────────────────────────────────────────

    function processCheckoutButtons() {
        var checkoutSelectors = [
            "[name=checkout]", "button[name='checkout']", "input[name='checkout']",
            ".cart__checkout-button", ".cart__checkout", "a.cart__checkout-button",
            "a[href='/checkout']", "button.checkout-button", ".checkout-button",
            ".cart-drawer__checkout-button", "#anubis-checkout-btn",
        ];

        var btns = document.querySelectorAll(checkoutSelectors.join(', '));

        btns.forEach(function (btn) {
            if (btn.dataset.anubisCheckoutProcessed) return;
            btn.dataset.anubisCheckoutProcessed = 'true';

            if (btn.tagName === 'A') btn.href = 'javascript:void(0);';
            if (btn.type === 'submit') btn.type = 'button';

            btn.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                window.location.href = relPath('checkout.html');
            }, { capture: true, passive: false });
        });
    }

    if (shopTemplateName === 'cart') {
        processCheckoutButtons();
    }

    if (!window.anubisCartDrawerObserver) {
        window.anubisCartDrawerObserver = new MutationObserver(function (mutations) {
            var shouldProcess = false;
            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1 && node.matches) {
                            if (node.matches('.cart-drawer') || node.matches('[class*="cart"]') ||
                                (node.querySelector && (node.querySelector('.cart__checkout-button') || node.querySelector('[name="checkout"]')))) {
                                shouldProcess = true;
                            }
                        }
                    });
                }
                if (mutation.type === 'attributes' && mutation.target.nodeType === 1) {
                    var t = mutation.target;
                    if (t.matches && (t.matches('.cart-drawer') || t.matches('[class*="drawer"]') || t.matches('[class*="cart"]'))) {
                        var isVisible = t.style.display !== 'none' && t.style.visibility !== 'hidden' && !t.classList.contains('hidden');
                        if (isVisible) shouldProcess = true;
                    }
                }
            });
            if (shouldProcess) setTimeout(processCheckoutButtons, 100);
        });

        window.anubisCartDrawerObserver.observe(document.body, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'style'],
        });
    }

    // ─── Product / index page: "Comprar agora" ────────────────────────────────

    if ((shopTemplateName === 'product' || shopTemplateName === 'index') && checkoutSkipCart) {
        insertClickListenerToButtons();
    }

    function insertClickListenerToButtons() {
        var sellButtons = [
            'button.button--addToCart', 'button.ProductForm__AddToCart',
            'button.product-form__add-button', 'button#add-to-cart',
            'button.add-to-cart-btn', 'button.add-to-cart', 'button.button-buy',
            'button#buttonBuy', 'button#AddToCartText', 'button#AddToCart',
            'input[name="add"]', "button[name='add']", 'button.single_add_to_cart_button',
            'button.buttonBuyNow', '.product-form__add-button',
            'button[data-action=add-to-cart]',
            'button[data-essential-cart-element="add-to-cart-button"]',
            'button.essential-preorder-extra-add-to-cart-button',
            'button#stickyatc', 'button#StickyAddToCart',
            'button.shopify-payment-button', 'button.btn_checkout',
        ];

        var addCartBtns = document.querySelectorAll(sellButtons.join(', '));

        if (!addCartBtns || !addCartBtns.length) {
            setTimeout(insertClickListenerToButtons, 500);
            return;
        }

        addCartBtns.forEach(function (btn) {
            if (btn.dataset.anubisProcessed) return;
            btn.dataset.anubisProcessed = 'true';

            if (btn.tagName === 'A' && btn.href) btn.href = 'javascript:void(0);';
            if (btn.type === 'submit') btn.type = 'button';
            if (btn.onclick) btn.onclick = null;
            if (btn.getAttribute('onclick')) btn.removeAttribute('onclick');

            var buttonRef = btn;

            btn.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                if (isLoadingSecureCheckout) return;
                showSecureLoader();
                addToCartAndRedirect(buttonRef);
            }, { capture: true, passive: false });
        });
    }

    if (!window.anubisObserver) {
        window.anubisObserver = new MutationObserver(function (mutations) {
            var shouldRetry = false;
            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1 && node.matches) {
                            if (node.matches('button.product-form__add-button') ||
                                node.matches('button[data-action="add-to-cart"]') ||
                                (node.querySelector && node.querySelector('button.product-form__add-button'))) {
                                shouldRetry = true;
                            }
                        }
                    });
                }
            });
            if (shouldRetry) setTimeout(insertClickListenerToButtons, 100);
        });

        window.anubisObserver.observe(document.body, { childList: true, subtree: true });
    }

} // Fim da proteção contra execução múltipla
