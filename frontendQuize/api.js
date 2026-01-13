
const API_BASE_URL = '/api'

class ApiService {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        
        const token = localStorage.getItem('access_token');
        const tokenType = localStorage.getItem('token_type') || 'bearer';
        
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        
        if (token) {
            headers['Authorization'] = `${tokenType} ${token}`;
        }
        
        const config = {
            headers,
            ...options,
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                
                if (response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('token_type');
                    
                    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
                    if (currentUrl && !currentUrl.includes('login.html') && !currentUrl.includes('register.html')) {
                        sessionStorage.setItem('returnUrl', currentUrl);
                    }
                    window.location.href = 'login.html';
                    return;
                }
                
                
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    
                }
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    

    
    async getQuizzes() {
        
        return this.request('/quizzes/');
    }

    
    async getQuiz(id) {
        
        return this.request(`/quizzes/${id}`);
    }

    
    
    async createQuiz({ title, description }) {
        const payload = {
            title,
            description: description || null,
            is_public: false,
        };
        
        return this.request('/quizzes/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    
    async updateQuiz(id, quizData) {
        return this.request(`/quizzes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(quizData),
        });
    }

    
    async deleteQuiz(id) {
        return this.request(`/quizzes/${id}`, {
            method: 'DELETE',
        });
    }

    

    
    async getQuestions(quizId) {
        return this.request(`/questions/?quiz_id=${quizId}`);
    }

    
    async createQuestion(quizId, questionData) {
        return this.request(`/questions/quiz/${quizId}`, {
            method: 'POST',
            body: JSON.stringify(questionData),
        });
    }

    
    async updateQuestion(questionId, questionData) {
        return this.request(`/questions/${questionId}`, {
            method: 'PUT',
            body: JSON.stringify(questionData),
        });
    }

    
    async deleteQuestion(questionId) {
        return this.request(`/questions/${questionId}`, {
            method: 'DELETE',
        });
    }

    

    
    async signup({ username, email, password, role = "user" }) {
        const payload = {
            username,
            email,
            password,
            role,
        };
        return this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    
    async getCurrentUser() {
        return this.request('/users/me');
    }

    
    async login(email, password) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const url = `${this.baseUrl}/auth/token`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });

            if (!response.ok) {
                
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    
                }
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error('Login request failed:', error);
            throw error;
        }
    }

    

    
    async getSessions() {
        return this.request('/sessions/');
    }

    
    async getEndedSessions() {
        return this.request('/sessions/ended');
    }

    
    async createSession({ quiz_id, url, status = 'waiting' }) {
        const payload = {
            quiz_id,
            url,
            status,
            host_id: 0, 
        };
        return this.request('/sessions/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    
    async getSession(sessionId) {
        return this.request(`/sessions/${sessionId}`);
    }

    
    async updateSession(sessionId, sessionData) {
        return this.request(`/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(sessionData),
        });
    }

    
    async deleteSession(sessionId) {
        return this.request(`/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    }

    
    async getCurrentQuestion(sessionId) {
        return this.request(`/sessions/${sessionId}/current-question`);
    }

    
    async getSessionStatistics(sessionId) {
        return this.request(`/sessions/${sessionId}/statistics`);
    }

    
    async nextQuestion(sessionId) {
        return this.request(`/sessions/${sessionId}/questions/next`, {
            method: 'POST',
        });
    }

    

    
    async uploadMedia(file) {
        const url = `${this.baseUrl}/media/upload`;
        
        
        const token = localStorage.getItem('access_token');
        const tokenType = localStorage.getItem('token_type') || 'bearer';
        
        
        const formData = new FormData();
        formData.append('file', file);
        
        
        const headers = {};
        if (token) {
            headers['Authorization'] = `${tokenType} ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData,
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('token_type');
                    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
                    if (currentUrl && !currentUrl.includes('login.html') && !currentUrl.includes('register.html')) {
                        sessionStorage.setItem('returnUrl', currentUrl);
                    }
                    window.location.href = 'login.html';
                    return;
                }
                
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    
                }
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error('Media upload failed:', error);
            throw error;
        }
    }

    
    async getMedia(mediaId) {
        return this.request(`/media/${mediaId}`);
    }

    
    getMediaUrl(uri) {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return uri;
        }
        // Если URI начинается с /media/, не добавляем /api, так как nginx раздает /media/ напрямую
        if (uri.startsWith('/api/')) {
            return uri;
        }
        return `${this.baseUrl}${uri}`;
    }
}


const apiService = new ApiService();



