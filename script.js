document.addEventListener('DOMContentLoaded', () => {
    const chineseWordEl = document.getElementById('chineseWord');
    const englishInput = document.getElementById('englishInput');
    const checkBtn = document.getElementById('checkBtn');
    const nextBtn = document.getElementById('nextBtn');
    const feedbackEl = document.getElementById('feedback');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    const testCard = document.getElementById('testCard');
    const groupSelect = document.getElementById('groupSelect');
    const speakBtn = document.getElementById('speakBtn');

    let vocabulary = [];
    let currentPool = []; // 當前組別的單字池
    let currentWordIndex = -1;
    let score = 0;
    let totalCompleted = 0;
    const GROUP_SIZE = 20;

    // Fetch and parse CSV
    async function loadVocabulary() {
        try {
            const response = await fetch('words.csv');
            if (!response.ok) throw new Error('Fetch failed');
            const data = await response.text();
            parseCSV(data);
        } catch (error) {
            console.error('Error loading CSV (likely CORS):', error);
            chineseWordEl.textContent = '請載入單字檔';
            document.getElementById('filePickerArea').style.display = 'block';
        }
    }

    function parseCSV(data) {
        vocabulary = data.trim().split('\n').map((line, index) => {
            const [english, chinese] = line.split(',');
            return { 
                english: english?.trim().toLowerCase(), 
                chinese: chinese?.trim(),
                originalIndex: index,
                remainingCount: 1,      // 需要出現的次數
                isFirstAttempt: true    // 是否為第一次測試
            };
        }).filter(item => item.english && item.chinese);

        if (vocabulary.length > 0) {
            document.getElementById('filePickerArea').style.display = 'none';
            setupGroups();
        } else {
            chineseWordEl.textContent = 'CSV 格式錯誤';
        }
    }

    function setupGroups() {
        groupSelect.innerHTML = '';
        const numGroups = Math.ceil(vocabulary.length / GROUP_SIZE);
        
        for (let i = 0; i < numGroups; i++) {
            const start = i * GROUP_SIZE + 1;
            const end = Math.min((i + 1) * GROUP_SIZE, vocabulary.length);
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `第 ${i + 1} 組 (${start}-${end})`;
            groupSelect.appendChild(option);
        }

        // 預設選擇第一組
        selectGroup(0);
    }

    function selectGroup(groupIndex) {
        const start = groupIndex * GROUP_SIZE;
        const end = start + GROUP_SIZE;
        
        // 取得該組單字，並重置狀態
        currentPool = vocabulary.slice(start, end).map(w => ({
            ...w,
            remainingCount: 1,
            isFirstAttempt: true
        }));
        
        currentWordIndex = -1;
        score = 0;
        scoreDisplay.textContent = `得分: ${score}`;
        
        // UI Reset
        englishInput.style.display = 'block';
        checkBtn.style.display = 'block';
        speakBtn.style.display = 'flex';
        
        showNextWord();
    }

    // Handle manual file upload
    document.getElementById('csvFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => parseCSV(event.target.result);
            reader.readAsText(file);
        }
    });

    groupSelect.addEventListener('change', (e) => {
        selectGroup(parseInt(e.target.value));
    });

    function showNextWord() {
        // 篩選出還需要測試的單字 (按照順序)
        let nextIndex = currentPool.findIndex(w => w.remainingCount > 0);
        
        // 如果目前沒題目了，檢查是否有需要複習的單字
        if (nextIndex === -1) {
            const reviewWords = currentPool.filter(w => w.needsReview);
            if (reviewWords.length > 0) {
                // 進入複習模式：將所有標記為 needsReview 的單字重新投入池中
                reviewWords.forEach(w => {
                    w.remainingCount = 1;
                    w.needsReview = false;
                });
                feedbackEl.textContent = '進入複習模式，重新測試剛才錯誤的單字';
                feedbackEl.className = 'feedback show';
                setTimeout(showNextWord, 2000);
                return;
            }

            // 真正完成本組
            chineseWordEl.innerHTML = '<span style="font-size: 0.8em">🎉</span> 本組完成！';
            englishInput.style.display = 'none';
            checkBtn.style.display = 'none';
            speakBtn.style.display = 'none';
            feedbackEl.textContent = `本組得分: ${score}`;
            feedbackEl.classList.add('show', 'correct');
            totalDisplay.textContent = `待處理: 0`;
            
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#646cff', '#42b883', '#ff4757', '#ffa502']
            });
            return;
        }

        // Reset UI
        feedbackEl.classList.remove('show', 'correct', 'wrong');
        feedbackEl.textContent = '';
        englishInput.value = '';
        englishInput.style.display = 'block';
        checkBtn.style.display = 'block';
        englishInput.focus();
        testCard.classList.remove('shake', 'pulse');

        // 循序取得下一個單字
        currentWordIndex = nextIndex;
        const selectedWord = currentPool[currentWordIndex];
        
        chineseWordEl.textContent = selectedWord.chinese;
        
        // 更新進度顯示 (顯示本組剩餘題數)
        const remainingInPool = currentPool.filter(w => w.remainingCount > 0).length;
        const totalReviewRemaining = currentPool.filter(w => w.needsReview).length;
        totalDisplay.textContent = totalReviewRemaining > 0 ? `本輪剩餘: ${remainingInPool} (待複習: ${totalReviewRemaining})` : `本組剩餘: ${remainingInPool}`;
    }

    function checkAnswer() {
        const word = currentPool[currentWordIndex];
        const userAnswer = englishInput.value.trim().toLowerCase();
        const correctAnswer = word.english;

        if (!userAnswer) return;

        if (userAnswer === correctAnswer) {
            // 答對了
            word.remainingCount = 0;
            
            score++;
            scoreDisplay.textContent = `得分: ${score}`;
            feedbackEl.textContent = word.isFirstAttempt ? '一次就對！太強了' : '複習正確！';
            feedbackEl.className = 'feedback show correct';
            testCard.classList.add('pulse');
            
            setTimeout(showNextWord, 1000);
        } else {
            // 答錯了
            englishInput.value = ''; // 答錯即清空輸入框
            if (word.isFirstAttempt) {
                word.needsReview = true; // 標記為需要複習
                word.remainingCount = 0; // 暫時從目前輪值中移除
                word.isFirstAttempt = false;
            } else {
                // 複習階段若又錯，保持 remainingCount = 1，直到答對為止
                word.remainingCount = 1;
            }
            
            feedbackEl.textContent = `不正確，答案是: ${correctAnswer}`;
            feedbackEl.className = 'feedback show wrong';
            testCard.classList.add('shake');
            
            setTimeout(() => testCard.classList.remove('shake'), 400);
        }
    }

    // Event Listeners
    checkBtn.addEventListener('click', checkAnswer);

    englishInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkAnswer();
        }
    });

    function playPronunciation() {
        const word = currentPool[currentWordIndex]?.english;
        if (!word) return;

        // Use Web Speech API
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);

        // Feedback animation for the button
        speakBtn.classList.add('playing');
        utterance.onend = () => speakBtn.classList.remove('playing');
    }

    speakBtn.addEventListener('click', (e) => {
        e.preventDefault();
        playPronunciation();
    });

    nextBtn.addEventListener('click', () => {
        // 如果當前單字還沒答對就按「下一個」，視同放棄並加入複習清單
        if (currentWordIndex !== -1 && currentPool[currentWordIndex]) {
            const word = currentPool[currentWordIndex];
            if (word.remainingCount > 0) {
                if (word.isFirstAttempt) {
                    word.needsReview = true;
                    word.isFirstAttempt = false;
                }
                word.remainingCount = 0; // 從本輪移除
            }
        }
        showNextWord();
    });

    // Initialize
    loadVocabulary();
});
