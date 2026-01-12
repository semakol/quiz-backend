function isAuthenticated() {
    const token = localStorage.getItem('access_token');
    return !!token;
}

function requireAuth(redirectUrl = 'login.html') {
    const currentPage = window.location.pathname.split('/').pop();
    const publicPages = ['login.html', 'register.html'];
    if (publicPages.includes(currentPage)) {
        return;
    }
    if (!isAuthenticated()) {
        const returnUrl = window.location.pathname + window.location.search + window.location.hash;
        if (returnUrl && returnUrl !== '/' && !returnUrl.includes('login.html') && !returnUrl.includes('register.html')) {
            sessionStorage.setItem('returnUrl', returnUrl);
        }
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    window.location.href = 'login.html';
}

function getAccessToken() {
    return localStorage.getItem('access_token');
}

function getTokenType() {
    return localStorage.getItem('token_type') || 'bearer';
}

function handleReturnUrl() {
    const returnUrl = sessionStorage.getItem('returnUrl');
    if (returnUrl) {
        sessionStorage.removeItem('returnUrl');
        window.location.href = returnUrl;
    }
}

if (typeof window !== 'undefined') {
    window.auth = {
        isAuthenticated,
        requireAuth,
        logout,
        getAccessToken,
        getTokenType,
        handleReturnUrl
    };
}

