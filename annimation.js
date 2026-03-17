(function () {

    gsap.registerPlugin(ScrollTrigger);

    var svgCounter = 0;

    // ── ID PREFIXING ──────────────────────────────────────────────────────
    function prefixSvgIds(svg, prefix) {
        var allEls = svg.querySelectorAll('[id]');
        var ids = [];

        allEls.forEach(function(el) {
            ids.push(el.id);
        });

        allEls.forEach(function(el) {
            el.id = prefix + '-' + el.id;
        });

        var styleEls = svg.querySelectorAll('style');
        var classNames = [];

        styleEls.forEach(function(styleEl) {
            var matches = styleEl.textContent.match(/\.([a-zA-Z][\w-]*)/g);
            if (matches) {
                matches.forEach(function(m) {
                    var cls = m.slice(1);
                    if (classNames.indexOf(cls) === -1) {
                        classNames.push(cls);
                    }
                });
            }
        });

        classNames.sort(function(a, b) {
            return b.length - a.length;
        });

        styleEls.forEach(function(styleEl) {
            var css = styleEl.textContent;

            classNames.forEach(function(cls) {
                var re = new RegExp('\\.' + cls.replace(/[-]/g, '\\-') + '(?=[\\s,{:+~>\\[)]|$)', 'g');
                css = css.replace(re, '.' + prefix + '-' + cls);
            });

            styleEl.textContent = css;
        });

        svg.querySelectorAll('[class]').forEach(function(el) {
            var classes = el.getAttribute('class').split(/\s+/);

            el.setAttribute('class',
                classes.map(function(cls) {
                    return classNames.indexOf(cls) !== -1 ? prefix + '-' + cls : cls;
                }).join(' ')
            );
        });

        svg.querySelectorAll('*').forEach(function(el) {

            ['href', 'xlink:href'].forEach(function(attr) {
                var val = el.getAttribute(attr);
                if (val && val.startsWith('#')) {
                    var ref = val.slice(1);
                    if (ids.indexOf(ref) !== -1) {
                        el.setAttribute(attr, '#' + prefix + '-' + ref);
                    }
                }
            });

            ['style', 'fill', 'clip-path', 'mask', 'filter'].forEach(function(attr) {
                var val = el.getAttribute(attr);
                if (val && val.indexOf('url(#') !== -1) {
                    val = val.replace(/url\(#([^)]+)\)/g, function(match, ref) {
                        return ids.indexOf(ref) !== -1 ? 'url(#' + prefix + '-' + ref + ')' : match;
                    });
                    el.setAttribute(attr, val);
                }
            });

        });
    }

    function trimViewBox(svg, padding) {
        padding = padding || 4;

        try {
            svg.style.visibility = 'hidden';
            var bbox = svg.getBBox();
            svg.style.visibility = '';

            if (bbox && bbox.width > 0 && bbox.height > 0) {
                svg.setAttribute(
                    'viewBox',
                    (bbox.x - padding) + ' ' +
                    (bbox.y - padding) + ' ' +
                    (bbox.width + padding * 2) + ' ' +
                    (bbox.height + padding * 2)
                );
            }
        } catch (e) {}
    }

    // ── FETCH + SWAP ──────────────────────────────────────────────────────
    function swapAndAnimate(img) {
        if (img.dataset.animating) return;

        img.dataset.animating = 'true';

        fetch(img.src)
            .then(function(r) { return r.text(); })
            .then(function(svgText) {

                var parser = new DOMParser();
                var doc = parser.parseFromString(svgText, 'image/svg+xml');
                var svg = doc.querySelector('svg');

                svg.style.width = '100%';
                svg.style.height = 'auto';
                svg.style.display = 'block';

                svgCounter++;
                var prefix = 'svg' + svgCounter;

                prefixSvgIds(svg, prefix);

                img.parentElement.replaceChild(svg, img);

                trimViewBox(svg, 4);

                if (svg.closest('.popup-expand')) return;

                var chartType = detectChartType(svg);

                prepareAnimation(svg, chartType);
                attachIntersectionTrigger(svg, chartType);
            })
            .catch(function(e) {
                console.warn('SVG fetch failed:', e);
            });
    }

    // ── INTERSECTION TRIGGER ──────────────────────────────────────────────
    function attachIntersectionTrigger(svg, chartType) {

        var pendingTimer = null;
        var activeTimeline = null;
        var isAnimating = false;

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {

                if (entry.isIntersecting) {

                    clearTimeout(pendingTimer);

                    pendingTimer = setTimeout(function() {

                        if (activeTimeline) {
                            activeTimeline.kill();
                            activeTimeline = null;
                        }

                        prepareAnimation(svg, chartType);
                        activeTimeline = fireAnimation(svg, chartType);
                        isAnimating = true;

                    }, 830);

                } else {

                    clearTimeout(pendingTimer);

                    if (activeTimeline) {
                        activeTimeline.kill();
                        activeTimeline = null;
                    }

                    if (isAnimating) {
                        prepareAnimation(svg, chartType);
                        isAnimating = false;
                    }
                }

            });
        }, {
            threshold: 0.15
        });

        observer.observe(svg);
    }

    // ── CHART TYPE ────────────────────────────────────────────────────────
    function detectChartType(svg) {
        if (svg.querySelector('[id$="-Bar01"]')) return 'linebar';
        if (svg.querySelector('[id$="-chartcircles"]')) return 'plotted';
        if (svg.querySelector('[id$="-markersgroup"]')) return 'map';
        return 'groups';
    }

    function prepareAnimation(svg, t) {
        if (t === 'linebar') prepareLineBar(svg);
        else if (t === 'plotted') preparePlotted(svg);
        else if (t === 'map') prepareMap(svg);
        else prepareGroups(svg);
    }

    function fireAnimation(svg, t) {
        if (t === 'linebar') return animateLineBar(svg);
        if (t === 'plotted') return animatePlotted(svg);
        if (t === 'map') return animateMap(svg);
        return animateGroups(svg);
    }

    // ── INIT ──────────────────────────────────────────────────────────────
    function findAndSwap() {
        document
            .querySelectorAll('img[src*="FG-"], img[src*="Figure-"]')
            .forEach(swapAndAnimate);
    }

    findAndSwap();

    new MutationObserver(function() {
        findAndSwap();
    }).observe(document.body, {
        childList: true,
        subtree: true
    });

    // ── GENERIC GROUPS ────────────────────────────────────────────────────
    function fromVars(t) {
        return ({
            slideup: { y: 30 },
            slidedown: { y: -30 },
            slideright: { x: -30 },
            slideleft: { x: 30 }
        })[t] || {};
    }

    function toVars(t) {
        return ({
            slideup: { y: 0 },
            slidedown: { y: 0 },
            slideright: { x: 0 },
            slideleft: { x: 0 }
        })[t] || {};
    }

    function prepareGroups(svg) {
        svg.querySelectorAll('g[id]').forEach(function(g) {
            var s = g.id.replace(/^svg\d+-/, '');
            var m = s.match(/^(FadeSlow|Fade|SlideUp|SlideDown|SlideRight|SlideLeft)/i);

            if (m) {
                gsap.killTweensOf(g);
                gsap.set(
                    g,
                    Object.assign(
                        { opacity: 0 },
                        fromVars(m[1].toLowerCase())
                    )
                );
            }
        });
    }

    function animateGroups(svg) {
        var groups = [];

        svg.querySelectorAll('g[id]').forEach(function(g) {
            var s = g.id.replace(/^svg\d+-/, '');
            var m = s.match(/^(FadeSlow|Fade|SlideUp|SlideDown|SlideRight|SlideLeft)(\d+)$/i);

            if (m) {
                groups.push({
                    el: g,
                    type: m[1].toLowerCase(),
                    order: parseInt(m[2], 10)
                });
            }
        });

        if (!groups.length) return gsap.timeline();

        groups.sort(function(a, b) {
            return a.order - b.order;
        });

        var steps = {};

        groups.forEach(function(g) {
            (steps[g.order] = steps[g.order] || []).push(g);
        });

        var tl = gsap.timeline({
            defaults: {
                ease: 'power2.out',
                duration: 0.8
            }
        });

        Object.keys(steps)
            .map(Number)
            .sort(function(a, b) { return a - b; })
            .forEach(function(order, i) {

                steps[order].forEach(function(g) {
                    var vars = Object.assign(
                        { opacity: 1 },
                        toVars(g.type)
                    );

                    if (g.type === 'fadeslow') {
                        vars.duration = 2.4;
                    }

                    tl.to(g.el, vars, i === 0 ? '>' : '-=0.4');
                });

            });

        return tl;
    }

    // ── LINE + BAR ────────────────────────────────────────────────────────
    var AXIS_Y = 268.92;

    function getBarGroups(svg) {
        var groups = [];

        for (var i = 1; i <= 15; i++) {
            var g = svg.querySelector('[id$="-Bar' + (i < 10 ? '0' + i : '' + i) + '"]');
            if (g) groups.push(g);
        }

        return groups;
    }

    function prepareLineBar(svg) {
        var bars = getBarGroups(svg);
        var lg = svg.querySelector('[id$="-Line01"]');

        var le = lg ? lg.querySelector('polyline') : null;
        var ci = lg ? Array.from(lg.querySelectorAll('circle')) : [];
        var tx = lg ? Array.from(lg.querySelectorAll('text')) : [];

        bars.forEach(function(g) {
            gsap.killTweensOf(g);

            var r = g.querySelector('rect');
            var t = g.querySelector('text');

            if (r) gsap.killTweensOf(r);
            if (t) gsap.killTweensOf(t);
        });

        ci.forEach(function(c) { gsap.killTweensOf(c); });
        tx.forEach(function(t) { gsap.killTweensOf(t); });

        if (le) gsap.killTweensOf(le);
        if (lg) gsap.killTweensOf(lg);

        bars.forEach(function(g) {
            gsap.set(g, { opacity: 0 });
        });

        bars.forEach(function(g) {
            var r = g.querySelector('rect');
            if (r) {
                gsap.set(r, {
                    transformOrigin: '50% ' + AXIS_Y + 'px',
                    scaleY: 0
                });
            }
        });

        if (lg) gsap.set(lg, { opacity: 0 });

        if (le) {
            var len = le.getTotalLength();
            gsap.set(le, {
                strokeDasharray: len,
                strokeDashoffset: len,
                opacity: 1
            });
        }

        gsap.set(ci, {
            opacity: 0,
            scale: 0,
            transformOrigin: 'center center'
        });

        gsap.set(tx, { opacity: 0 });
    }

    function animateLineBar(svg) {
        var bars = getBarGroups(svg);
        var lg = svg.querySelector('[id$="-Line01"]');

        var le = lg ? lg.querySelector('polyline') : null;
        var ci = lg ? lg.querySelectorAll('circle') : [];
        var tx = lg ? lg.querySelectorAll('text') : [];

        var tl = gsap.timeline({
            defaults: { ease: 'power2.out' }
        });

        tl.to(bars, {
            opacity: 1,
            duration: 0,
            stagger: 0.06
        });

        tl.to(
            bars.map(function(g) { return g.querySelector('rect'); }).filter(Boolean),
            {
                scaleY: 1,
                duration: 0.6,
                stagger: 0.06
            },
            '<'
        );

        tl.to(
            bars.map(function(g) { return g.querySelector('text'); }).filter(Boolean),
            {
                opacity: 1,
                duration: 0.3,
                stagger: 0.04
            },
            '-=0.2'
        );

        tl.to(lg, { opacity: 1, duration: 0 }, '-=0.1');

        if (le) {
            tl.to(le, {
                strokeDashoffset: 0,
                duration: 1.8,
                ease: 'power1.inOut'
            }, '<');
        }

        tl.to(ci, {
            opacity: 1,
            scale: 1,
            duration: 0.25,
            stagger: 0.08,
            ease: 'back.out(2)'
        }, '<0.3');

        tl.to(tx, {
            opacity: 1,
            duration: 0.3,
            stagger: 0.05
        }, '-=1.2');

        return tl;
    }

    // ── PLOTTED POINTS ────────────────────────────────────────────────────
    function getPlottedEls(svg) {
        var bg  = Array.from(svg.querySelectorAll('[id$="-chartbackground"] path, [id$="-chartbackground"] polygon'));
        var bgt = Array.from(svg.querySelectorAll('[id$="-chartbackground"] text'));
        var ln  = Array.from(svg.querySelectorAll('[id$="-chartlines"] line, [id$="-chartlines"] polyline'));
        var ci  = Array.from(svg.querySelectorAll('[id$="-chartcircles"] path'));
        var lb  = Array.from(svg.querySelectorAll('[id$="-chartlabels"] text, [id$="-chartlabels"] g'));

        return {
            bg: bg,
            bgt: bgt,
            ln: ln,
            ci: ci,
            lb: lb,
            all: bg.concat(bgt, ln, ci, lb)
        };
    }

    function preparePlotted(svg) {
        var e = getPlottedEls(svg);

        e.all.forEach(function(el) {
            gsap.killTweensOf(el);
        });

        e.ln.forEach(function(el) {
            try {
                var len = el.getTotalLength();
                gsap.set(el, {
                    strokeDasharray: len,
                    strokeDashoffset: len
                });
            } catch (x) {}
        });

        gsap.set(e.all, { opacity: 0 });
    }

    function animatePlotted(svg) {
        var e = getPlottedEls(svg);

        var tl = gsap.timeline({
            defaults: { ease: 'power2.out' }
        });

        tl.to(e.bg,  { opacity: 1, duration: 0.8, stagger: 0.1 });
        tl.to(e.bgt, { opacity: 1, duration: 0.5 }, '-=0.3');
        tl.to(e.ln,  { strokeDashoffset: 0, opacity: 1, duration: 0.6, stagger: 0.04 }, '-=0.2');
        tl.to(e.ci,  {
            opacity: 1,
            scale: 1,
            duration: 0.35,
            stagger: 0.06,
            ease: 'back.out(1.7)',
            transformOrigin: 'center center'
        }, '-=0.1');

        tl.to(e.lb, { opacity: 1, duration: 0.4, stagger: 0.04 }, '-=0.2');

        return tl;
    }

    // ── MAP ───────────────────────────────────────────────────────────────
    function getMapLines(svg) {
        var items = [];

        svg.querySelectorAll('[id]').forEach(function(el) {
            var s = el.id.replace(/^svg\d+-/, '');

            if (/^mp[a]?lines\d+$/i.test(s)) {
                items.push({
                    el: el,
                    order: parseInt(s.replace(/\D/g, ''), 10)
                });
            }
        });

        return items.sort(function(a, b) {
            return a.order - b.order;
        });
    }

    function prepareMap(svg) {
        var lines = getMapLines(svg);
        var mg = svg.querySelector('[id$="-markersgroup"]');
        var lg = svg.querySelector('[id$="-markerslabels"]');

        var mc = mg ? Array.from(mg.children) : [];

        lines.forEach(function(item) {
            gsap.killTweensOf(item.el);
        });

        mc.forEach(function(c) {
            gsap.killTweensOf(c);
        });

        if (mg) gsap.killTweensOf(mg);
        if (lg) gsap.killTweensOf(lg);

        lines.forEach(function(item) {

            gsap.set(item.el, { opacity: 0 });

            var isG = item.el.tagName.toLowerCase() === 'g';
            var ses = isG
                ? Array.from(item.el.querySelectorAll('line,polyline,path'))
                : [item.el];

            ses.forEach(function(el) {
                gsap.killTweensOf(el);

                try {
                    var len = el.getTotalLength();
                    gsap.set(el, {
                        strokeDasharray: len,
                        strokeDashoffset: len
                    });
                } catch (x) {}
            });

        });

        if (mg) gsap.set(mg, { opacity: 0 });
        if (lg) gsap.set(lg, { opacity: 0 });

        gsap.set(mc, {
            scale: 0,
            transformOrigin: 'center center',
            opacity: 0
        });
    }

    function animateMap(svg) {
        var lines = getMapLines(svg);
        var mg = svg.querySelector('[id$="-markersgroup"]');
        var lg = svg.querySelector('[id$="-markerslabels"]');

        var mc = mg ? Array.from(mg.children) : [];

        var tl = gsap.timeline({
            defaults: { ease: 'power2.out' }
        });

        lines.forEach(function(item, i) {

            var isG = item.el.tagName.toLowerCase() === 'g';
            var ses = isG
                ? Array.from(item.el.querySelectorAll('line,polyline,path'))
                : [item.el];

            tl.to(item.el, {
                opacity: 1,
                duration: 0
            }, i === 0 ? '>' : '-=0.3');

            if (ses.length) {
                tl.to(ses, {
                    strokeDashoffset: 0,
                    opacity: 1,
                    duration: 0.8,
                    stagger: 0.04,
                    ease: 'power1.inOut'
                }, '<');
            }

        });

        if (mc.length) {
            tl.to(mc, {
                opacity: 1,
                scale: 1,
                duration: 0.3,
                stagger: 0.07,
                ease: 'back.out(2)'
            }, '-=0.2');
        } else if (mg) {
            tl.to(mg, {
                opacity: 1,
                duration: 0.4
            }, '-=0.2');
        }

        if (lg) {
            tl.to(lg, {
                opacity: 1,
                duration: 0.6
            }, '-=0.1');
        }

        return tl;
    }

})();
