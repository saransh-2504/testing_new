document.addEventListener("DOMContentLoaded", () => {

    const authOverlay = document.getElementById("authOverlay");
    const signupBox = document.getElementById("signupBox");
    const loginBox = document.getElementById("loginBox");
    const forgotBox = document.getElementById("forgotBox");
    const greetUser = document.getElementById("greetUser");
    const newsContainer = document.querySelector(".news-container");
    const searchInput = document.getElementById("searchInput");
    const categoryButtons = document.querySelectorAll(".cat");
    const offlineBanner = document.getElementById("offlineBanner");
    const loader = document.getElementById("loader");


    // DARK MODE TOGGLE

    const themeToggle = document.getElementById("themeToggle");
    let saved = localStorage.getItem("themeMode");
    if (saved === "dark") {
        document.body.classList.add("dark");
        themeToggle.textContent = "☀️";
    }
    if (themeToggle) {
        themeToggle.style.cursor = "pointer";
        themeToggle.addEventListener("click", () => {
            const isDark = document.body.classList.toggle("dark");
            themeToggle.textContent = isDark ? "☀️" : "🌙";
            localStorage.setItem("themeMode", isDark ? "dark" : "light");
        });
    }

    // INDEXEDDB (newsDB)

    let db;
    const DB_VERSION = 2;
    const DB_NAME = "newsDB";
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);
    openReq.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains("articles")) {
            db.createObjectStore("articles", { keyPath: "link" });
        }
        if (!db.objectStoreNames.contains("saved")) {
            db.createObjectStore("saved", { keyPath: "link" });
        }
    };

    openReq.onsuccess = (e) => {
        db = e.target.result;
        console.log("IndexedDB ready");

        // offline launch 
        if (!navigator.onLine) {
            const stored = JSON.parse(localStorage.getItem("lastVisibleArticles") || "[]");
            const loggedUser = localStorage.getItem("loggedUser");

            if (loggedUser) {
                authOverlay.style.display = "none";
                document.body.classList.remove("blur");
                if (stored.length) {
                    newsContainer.innerHTML = "";
                    stored.forEach(a => displayNews([a]));
                }
                console.log("Offline launch → restored last visible articles");
                return;
            }
            console.log("Offline launch without login → waiting for user login");
            return;
        }

        const loggedUser = localStorage.getItem("loggedUser");
        if (loggedUser) {
            if (!navigator.onLine) {
                loadFromDBArticles();
            }
            else {
                loadNews();
            }
        }
    };

    openReq.onerror = (e) => {
        console.warn("IndexedDB failed to open", e);
    };

    //signup, login, logout, forgot
    document.body.classList.add("blur");
    const storedUser = JSON.parse(localStorage.getItem("userData") || "null");
    const loggedUser = localStorage.getItem("loggedUser");
    if (!navigator.onLine && loggedUser) {
        authOverlay.style.display = "none";
        document.body.classList.remove("blur");
        const storedArticles = JSON.parse(localStorage.getItem("lastVisibleArticles") || "[]");
        if (storedArticles.length) {
            newsContainer.innerHTML = "";
            storedArticles.forEach(a => displayNews([a]));
        }
        console.log("Offline launch/login → showing last visible articles");
        return;
    }

    if (navigator.onLine && loggedUser && storedUser) {
        greetUser.innerText = "Welcome, " + storedUser.first + "!";
        authOverlay.style.display = "none";
        document.body.classList.remove("blur");
    }

    window.showLogin = function () {
        signupBox.style.display = "none";
        loginBox.style.display = "block";
        forgotBox.style.display = "none";
    };

    window.showSignup = function () {
        signupBox.style.display = "block";
        loginBox.style.display = "none";
        forgotBox.style.display = "none";
    };

    window.showForgot = function () {
        signupBox.style.display = "none";
        loginBox.style.display = "none";
        forgotBox.style.display = "block";
    };

    window.signup = function () {
        try {
            const user = {
                first: document.getElementById("firstName").value.trim(),
                last: document.getElementById("lastName").value.trim(),
                email: document.getElementById("signupEmail").value.trim(),
                password: document.getElementById("signupPassword").value.trim()
            };

            if (!user.first || !user.last || !user.email || !user.password) {
                alert("Please fill all fields.");
                return;
            }

            localStorage.setItem("userData", JSON.stringify(user));
            localStorage.setItem("loggedUser", user.email);

            greetUser.innerText = "Welcome, " + user.first + "!";
            authOverlay.style.display = "none";
            document.body.classList.remove("blur");
            loadNews();


        } catch (err) {
            console.error("Signup error:", err);
            alert("An error occurred during signup.");
        }
    };

    window.login = function () {
        try {
            const email = document.getElementById("loginEmail").value.trim();
            const pass = document.getElementById("loginPassword").value.trim();
            const user = JSON.parse(localStorage.getItem("userData") || "null");

            if (!user) {
                alert("No account found. Please sign up first.");
                return;
            }

            if (email === user.email && pass === user.password) {
                localStorage.setItem("loggedUser", user.email);
                greetUser.innerText = "WELCOME, " + user.first + "!";
                authOverlay.style.display = "none";
                document.body.classList.remove("blur");
                if (!navigator.onLine) {
                    const stored = JSON.parse(localStorage.getItem("lastVisibleArticles") || "[]");
                    newsContainer.innerHTML = "";
                    if (stored.length) {
                        stored.forEach(a => displayNews([a]));
                    }
                    return;
                }
                loadNews();
            }
            else {
                alert("Incorrect email or password.");
            }
        }
        catch (err) {
            console.error("Login error:", err);
            alert("An error occurred during login.");
        }
    };

    window.resetPassword = function () {
        try {
            const email = document.getElementById("forgotEmail").value.trim();
            const newPass = document.getElementById("newPassword").value.trim();
            const user = JSON.parse(localStorage.getItem("userData") || "null");

            if (!user || email !== user.email) {
                alert("Email not found!");
                return;
            }
            user.password = newPass;
            localStorage.setItem("userData", JSON.stringify(user));
            alert("Password reset successful!");
            showLogin();
        }
        catch (err) {
            console.error("Reset error:", err);
            alert("An error occurred.");
        }
    };

    window.logout = function () {
        localStorage.removeItem("loggedUser");
        document.body.classList.add("blur");
        authOverlay.style.display = "flex";
        alert("Logged out!");
    };

    // GNEWS INFINITE SCROLL
    const BATCH_SIZE = 10;
    const AUTO_BATCH_LIMIT = 20;
    let totalDisplayed = 0;
    let newsPool = [];
    let loadMoreButtonShown = false;

    const API_KEY = "01f34776ac18f47af61d0c44277a190d"; //                            --> API KEY 
    let currentCategory = "general";
    let searchText = "";
    let pageIndex = 0;
    let isLoading = false;

    const RANDOM_QUERIES = [
        "latest", "breaking news", "india news", "world updates",
        "news 2025", "global headlines", "today news", "fresh news"
    ];

    function buildApiURL() {
        const q = searchText || RANDOM_QUERIES[pageIndex % RANDOM_QUERIES.length];
        return `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&topic=${currentCategory}&lang=en&page=${pageIndex}&apikey=${API_KEY}`;

    }

    async function loadNews() {
        if (!navigator.onLine) {
            console.log("Loading articles from IndexedDB (offline)");
            showOfflineBanner(true);
            loadFromDBArticles();
            return;
        } else {
            showOfflineBanner(false);
        }

        if (isLoading) return;
        loader.style.display = "block";

        if (!API_KEY) {
            newsContainer.innerHTML = "<h3>Please add your GNews API key in java.js to load online news. Loading cached articles if available...</h3>";
            loadFromDBArticles();
            return;
        }

        isLoading = true;
        const url = buildApiURL();

        try {
            // ---- LOCAL & DEPLOYED API SUPPORT ----
            const LOCAL_API = "http://localhost:3000/api/news";
            const DEPLOYED_API = "/api/news";

            // Use correct API depending on where app runs
            const API_ENDPOINT = window.location.hostname === "localhost" ? LOCAL_API : DEPLOYED_API;
            const backendURL =
                `${API_ENDPOINT}?q=${encodeURIComponent(searchText || "latest")}` +
                `&topic=${currentCategory}` +
                `&page=${pageIndex}`;

            const res = await fetch(backendURL);

            const data = await res.json();

            if (data && data.articles && data.articles.length) {

                // Save articles into saved section
                try {
                    const tx = db.transaction("articles", "readwrite");
                    const store = tx.objectStore("articles");
                    data.articles.forEach(async (a) => {
                        const base64Img = await convertImageToBase64(a.image);
                        const articleObj = {
                            title: a.title || "",
                            description: a.description || "",
                            url: a.url || a.link || "",
                            image: base64Img,
                            publishedAt: a.publishedAt || a.pubDate || ""
                        };
                        articleObj.link = articleObj.url;
                        store.put(articleObj);
                    });
                }
                catch (err) {
                    console.warn("Could not write to DB articles store:", err);
                }

                // Display articles
                const formatted = data.articles.map(a => ({
                    title: a.title,
                    description: a.description,
                    link: a.url || a.link,
                    image: a.image || ''
                }));

                // avoid duplicates
                formatted.forEach(item => {
                    if (!newsPool.find(x => x.link === item.link)) {
                        newsPool.push(item);
                    }
                });
                pageIndex++;

                if (totalDisplayed === 0) {
                    loader.style.display = "block";
                    setTimeout(() => {
                        loader.style.display = "none";
                        renderNextBatch();
                        loadSecondBatch();
                    }, 1500);
                }
                else {
                    renderNextBatch();
                }
            }
            else {
                console.warn("No articles returned from GNews for URL:", url);
            }
        }
        catch (err) {
            console.error("GNews fetch error:", err);
        }
        finally {
            isLoading = false;
            loader.style.display = "none";
        }
    }
    function displayNews(articles) {
        if (!articles || !articles.length) {
            if (!newsContainer.children.length) {
                newsContainer.innerHTML = "<h3>No news found.</h3>";
            }
            return;
        }

        articles.forEach(article => {
            const card = document.createElement("div");
            card.className = "card";

            const safeTitle = (article.title || "No title").replace(/"/g, '&quot;');
            const safeDesc = (article.description || "").replace(/"/g, '&quot;');
            const safeImg = (article.image || "").replace(/"/g, '&quot;');

            // CLEAN IMAGE URL
            let imgUrl = article.image;
            if (!navigator.onLine && !imgUrl.startsWith("data:image")) {
                imgUrl = "https://via.placeholder.com/600x400.png?text=No+Image+Available";
            }

            // Iif image is not available then replace it 
            if (!imgUrl || typeof imgUrl !== "string" || imgUrl.length < 5) {
                imgUrl = "https://via.placeholder.com/600x400.png?text=No+Image+Available";
            }

            card.innerHTML = `<img src="${imgUrl}" alt="Article Image"
      onerror="this.onerror=null; this.src='https://via.placeholder.com/600x400.png?text=No+Image+Available';"/>
      <div class="content">
        <div class="tag">${currentCategory.toUpperCase()}</div>
        <div class="title-text">${article.title || ""}</div>
        <div class="desc">${article.description || ""}</div>
        <div class="actions">
        <span class="save-btn" data-link="${article.link}" data-title="${safeTitle}" data-img="${safeImg}" data-desc="${safeDesc}">🤍 Save</span>
        <a href="${article.link}" class="btn" target="_blank" rel="noopener">Read More</a>
        </div>
      </div>`;

            newsContainer.appendChild(card);
            saveCurrentlyVisibleArticles();

            (function markSavedIfNeeded() {
                if (!db) {
                    return
                }
                try {
                    const link = article.link;
                    const tx = db.transaction("saved", "readonly");
                    const store = tx.objectStore("saved");
                    const getReq = store.get(link);
                    getReq.onsuccess = () => {
                        if (getReq.result) {
                            const btn = card.querySelector(".save-btn");
                            if (btn) {
                                btn.classList.add("saved");
                                btn.innerHTML = '❤️ Saved';
                            }
                        }
                    };
                }
                catch (err) {
                    console.warn("Could not check saved state:", err);
                }
            });
        });
    }

    function saveCurrentlyVisibleArticles() {
        const cards = document.querySelectorAll(".card");
        const list = [];
        cards.forEach(card => {
            const title = card.querySelector(".title-text")?.innerText || "";
            const desc = card.querySelector(".desc")?.innerText || "";
            const img = card.querySelector("img")?.src || "";
            const link = card.querySelector("a.btn")?.href || "";
            list.push({ title, desc, img, link });
        });

        localStorage.setItem("lastVisibleArticles", JSON.stringify(list));
    }

    function searchOffline(keyword) {
        const stored = JSON.parse(localStorage.getItem("lastVisibleArticles") || "[]");
        if (!stored.length) {
            return
        }
        const lower = keyword.toLowerCase();
        const results = stored.filter(a =>
            a.title.toLowerCase().includes(lower) ||
            a.desc.toLowerCase().includes(lower)
        );
        newsContainer.innerHTML = "";
        results.forEach(a => displayNews([a]));
    }

    // Load articles from saved section
    function loadFromDBArticles() {
        if (!db) {
            newsContainer.innerHTML = "<h3>No local DB available.</h3>";
            return;
        }

        const tx = db.transaction("articles", "readonly");
        const store = tx.objectStore("articles");
        const req = store.getAll();

        req.onsuccess = () => {
            const items = req.result || [];
            if (!items.length) {
                newsContainer.innerHTML = "<h3>No cached articles available.</h3>";
                return;
            }
            newsContainer.innerHTML = "";
            newsPool = items.map(i => ({
                title: i.title,
                description: i.description,
                link: i.link,
                image: i.image
            }));

            renderNextBatch();

            if (newsPool.length === 0) {
                showSyncButton();
            }

            function showSyncButton() {
                const div = document.createElement("div");
                div.innerText = "Sync with Internet";
                div.style.textAlign = "center";
                div.style.margin = "20px";
                div.style.fontSize = "18px";
                document.body.appendChild(div);
            }
        };
        req.onerror = () => {
            newsContainer.innerHTML = "<h3>Could not load cached articles.</h3>";
        };
    }

    function showOfflineBanner(show) {
        if (!offlineBanner) return;
        offlineBanner.style.display = show ? "block" : "none";
    }

    // Category click handler
    categoryButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            categoryButtons.forEach(b => b.classList.remove("active-cat"));
            btn.classList.add("active-cat");
            currentCategory = btn.dataset.category || "general";
            newsContainer.innerHTML = "";
            pageIndex = 0;
            loadNews();
        });
    });

    // Debounced search
    let searchTimer;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            const keyword = searchInput.value.trim();
            if (!navigator.onLine) {
                searchOffline(keyword);
                return;
            }
            searchText = keyword;
            newsContainer.innerHTML = "";
            pageIndex = 0;
            loadNews();
        }, 400);
    });

    // Save article into saved store
    document.addEventListener("click", (e) => {
        if (e.target && e.target.classList.contains("save-btn")) {
            const link = e.target.dataset.link;
            const title = e.target.dataset.title || "Untitled";
            const img = e.target.dataset.img || "";
            const desc = e.target.dataset.desc || "";
            if (!db) {
                alert("Local DB not ready. Try again in a moment.");
                return;
            }
            const tx = db.transaction("saved", "readwrite");
            const store = tx.objectStore("saved");
            const article = { link, title, img, desc };
            const putReq = store.put(article);
            putReq.onsuccess = () => {
                e.target.classList.add("saved");
                e.target.innerHTML = '❤️ Saved';
            };
            putReq.onerror = () => {
                alert("Could not save article.");
            };
        }
    });

    // fetch more articles and store
    async function fetchAndCacheArticles() {
        if (!API_KEY) {
            return
        }
        const url = buildApiURL();
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!data.articles || !data.articles.length) {
                return
            }
            const formatted = data.articles.map(a => ({
                title: a.title,
                description: a.description,
                link: a.url || a.link,
                image: a.image || ""
            }));

            // push only unique items
            formatted.forEach(item => {
                if (!newsPool.find(x => x.link === item.link)) {
                    newsPool.push(item);
                }
            });

            // cache in IndexedDB
            try {
                const tx = db.transaction("articles", "readwrite");
                const store = tx.objectStore("articles");
                formatted.forEach(a => {
                    store.put({
                        title: a.title,
                        description: a.description,
                        link: a.link,
                        image: a.image,
                        publishedAt: new Date().toISOString()
                    });
                });
            }
            catch (e) {
                console.warn("Failed to write to DB:", e);
            }
            pageIndex++;
        }
        catch (err) {
            console.error("fetchAndCacheArticles error:", err);
        }
    }

    // take next 10 cards
    function renderNextBatch() {
        if (newsPool.length < BATCH_SIZE && navigator.onLine) {
            fetchMoreBeforeBatch().then(() => {
                actuallyRenderBatch();
            });
            return;
        }
        actuallyRenderBatch();
    }
    function fetchMoreBeforeBatch() {
        return new Promise(async (resolve) => {
            await fetchAndCacheArticles();
            resolve();
        });
    }

    function actuallyRenderBatch() {
        const slice = newsPool.splice(0, BATCH_SIZE);
        if (!slice.length) {
            return
        }
        displayNews(slice);
        totalDisplayed += slice.length;

        // load more
        if (totalDisplayed >= AUTO_BATCH_LIMIT && !loadMoreButtonShown) {
            showLoadMoreButton();
            loadMoreButtonShown = true;
        }
    }


    // second batch calling
    async function loadSecondBatch() {
        if (!navigator.onLine) return;
        if (newsPool.length < BATCH_SIZE) {
            await fetchAndCacheArticles();
        }
        loader.style.display = "block";
        setTimeout(() => {
            loader.style.display = "none";
            renderNextBatch();
        }, 1000);
    }

    // ---- LOAD MORE BUTTON ----
    function showLoadMoreButton() {
        const btn = document.createElement("a");
        btn.id = "loadMoreButton";
        btn.href = "#";
        btn.innerText = "Load More";
        btn.classList.add("load-more-link");
        btn.onclick = (e) => {
            e.preventDefault();
            renderNextBatch();
        };
        document.querySelector(".news-container").after(btn);
    }

    window.addEventListener("online", () => {
        showOfflineBanner(false);
        const btn = document.getElementById("loadMoreButton");
        const loadMore = document.getElementById("loadMoreButton");
        if (loadMore) {
            loadMore.innerText = "Load More";
            loadMore.classList.add("load-more-link");
            loadMore.classList.remove("sync-link");
            loadMore.onclick = (e) => {
                e.preventDefault();
                renderNextBatch();
            };
        }

        // Fetch new articles
        newsContainer.innerHTML = "";
        pageIndex = 0;
        newsPool = [];
        totalDisplayed = 0;
        loadMoreButtonShown = false;
        loadNews();
    });

    window.addEventListener("offline", () => {
        showOfflineBanner(true);

        // Sync with Internet
        const loadMore = document.getElementById("loadMoreButton");
        if (loadMore) {
            loadMore.innerText = "Sync with Internet";
            loadMore.classList.remove("load-more-link");
            loadMore.classList.add("sync-link");
            loadMore.onclick = (e) => {
                e.preventDefault();
                alert("Internet required to sync new articles!");
            };
            setTimeout(() => {
                if (!navigator.onLine) {
                    showOfflineBanner(true);
                } else {
                    loadNews();
                }
            }, 300);
        }
    });

});
