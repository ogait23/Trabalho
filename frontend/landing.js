// Presentation only: ordering and authentication remain in script.js.
(() => {
    const menu = document.getElementById('mobile-nav');
    const toggle = document.querySelector('.menu-toggle');
    function closeMenu() {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menu');
    }
    toggle.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        toggle.setAttribute('aria-expanded', String(!menu.hidden));
        toggle.setAttribute('aria-label', menu.hidden ? 'Abrir menu' : 'Fechar menu');
    });
    menu.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); }
    });
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.site-header')) closeMenu();
    });

    window.abrirDialogo = (id) => {
        closeMenu();
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        const dialog = document.getElementById(id);
        dialog.showModal();
        document.body.classList.add('modal-open');
    };
    document.querySelectorAll('[data-open]').forEach(button => {
        button.addEventListener('click', () => window.abrirDialogo(button.dataset.open));
    });
    document.querySelectorAll('dialog').forEach(dialog => {
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => {
            if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
        });
        dialog.addEventListener('click', event => {
            const rect = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
        });
    });

    let notificationTimer;
    window.notificar = (message) => {
        clearTimeout(notificationTimer);
        document.getElementById('notificacoes').textContent = '';
        document.querySelectorAll('.dialog-notice').forEach(notice => notice.remove());
        const openDialog = document.querySelector('dialog[open]');
        const target = openDialog ? document.createElement('div') : document.getElementById('notificacoes');
        if (openDialog) {
            target.className = 'dialog-notice';
            target.setAttribute('role', 'status');
            openDialog.querySelector('[data-close]').after(target);
            openDialog.scrollTop = 0;
        }
        target.textContent = message;
        notificationTimer = setTimeout(() => { target.textContent = ''; if (openDialog) target.remove(); }, 6500);
    };

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const scenes = [...document.querySelectorAll('[data-parallax]')];
    const reveals = [...document.querySelectorAll('.reveal')];
    let frame = 0;
    function paintScroll() {
        frame = 0;
        if (reduced.matches) return;
        const height = window.innerHeight;
        scenes.forEach(scene => {
            const rect = scene.getBoundingClientRect();
            if (rect.bottom < -100 || rect.top > height + 100) return;
            const progress = Math.max(-1, Math.min(1, (height / 2 - rect.top - rect.height / 2) / (height / 2)));
            scene.style.setProperty('--scroll', progress.toFixed(3));
            if (!finePointer.matches) {
                scene.style.setProperty('--rx', `${progress * 7}deg`);
                scene.style.setProperty('--ry', `${progress * -4}deg`);
            }
        });
    }
    function schedulePaint() {
        if (!frame && !reduced.matches) frame = requestAnimationFrame(paintScroll);
    }
    scenes.forEach(scene => {
        let pointerFrame = 0;
        scene.addEventListener('pointermove', event => {
            if (reduced.matches || !finePointer.matches || event.pointerType === 'touch') return;
            cancelAnimationFrame(pointerFrame);
            pointerFrame = requestAnimationFrame(() => {
                const rect = scene.getBoundingClientRect();
                scene.style.setProperty('--rx', `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 12}deg`);
                scene.style.setProperty('--ry', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 14}deg`);
            });
        }, { passive: true });
        scene.addEventListener('pointerleave', () => {
            cancelAnimationFrame(pointerFrame);
            scene.style.setProperty('--rx', '0deg');
            scene.style.setProperty('--ry', '0deg');
        });
    });
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });
        reveals.forEach(element => {
            if (!reduced.matches) element.classList.add('motion-ready');
            observer.observe(element);
        });
    }
    reduced.addEventListener('change', () => {
        if (reduced.matches) {
            reveals.forEach(element => element.classList.add('is-visible'));
            scenes.forEach(scene => { scene.style.setProperty('--scroll', '0'); scene.style.setProperty('--rx', '0deg'); scene.style.setProperty('--ry', '0deg'); });
        } else schedulePaint();
    });
    window.addEventListener('scroll', schedulePaint, { passive: true });
    window.addEventListener('resize', schedulePaint, { passive: true });
    schedulePaint();
})();
