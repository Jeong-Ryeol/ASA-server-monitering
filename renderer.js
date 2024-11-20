const AsaQuery = require('asa-query');

class ServerMonitor {
    constructor() {
        this.container = document.getElementById('serverList');
        this.monitors = [];
        const { ipcRenderer } = require('electron');
        
        // 마우스 이벤트가 필요한 요소들
        const interactiveElements = ['#addServer', '#closeApp', '#timerBtn', '.remove-btn', '.server-input'];
        
        // mouseover 이벤트 리스너
        document.addEventListener('mouseover', (e) => {
            // 입력 중일 때는 마우스 이벤트 활성화
            if (document.activeElement.classList.contains('server-input')) {
                ipcRenderer.send('enable-mouse');
                return;
            }
            
            // 특정 버튼들에 대해서만 마우스 이벤트 활성화
            if (interactiveElements.some(selector => e.target.closest(selector))) {
                ipcRenderer.send('enable-mouse');
            }
        });
    
        // mouseout 이벤트 리스너
        document.addEventListener('mouseout', (e) => {
            // 입력 중이 아닐 때만 마우스 이벤트 비활성화
            if (!document.activeElement.classList.contains('server-input')) {
                if (interactiveElements.some(selector => e.target.closest(selector))) {
                    ipcRenderer.send('disable-mouse');
                }
            }
        });
        
        // 입력 필드 focus/blur 이벤트
        document.addEventListener('focusin', (e) => {
            if (e.target.classList.contains('server-input')) {
                ipcRenderer.send('enable-mouse');
            }
        });
        
        document.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('server-input')) {
                ipcRenderer.send('disable-mouse');
            }
        });
        
        document.getElementById('addServer').addEventListener('click', () => this.addMonitor());
        document.getElementById('closeApp').addEventListener('click', () => window.close());
    }

    createMonitorElement() {
        const monitorDiv = document.createElement('div');
        monitorDiv.className = 'monitor';
        
        const playerLabel = document.createElement('span');
        playerLabel.className = 'player-count';
        playerLabel.textContent = 'Players: 0';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'server-input';
        input.placeholder = '#';
        
        const serverName = document.createElement('span');
        serverName.className = 'server-name';
        serverName.textContent = 'NONE';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        
        monitorDiv.appendChild(playerLabel);
        monitorDiv.appendChild(input);
        monitorDiv.appendChild(serverName);
        monitorDiv.appendChild(removeBtn);
        
        return { monitorDiv, playerLabel, input, serverName, removeBtn };
    }

    async addMonitor() {
        const elements = this.createMonitorElement();
        this.container.appendChild(elements.monitorDiv);
        
        let updateInterval = null;
        
        elements.input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const serverNumber = elements.input.value;
                elements.input.style.display = 'none';
                updateInterval = await this.startMonitoring(elements, serverNumber);
            }
        });
        
        elements.removeBtn.addEventListener('click', () => {
            if (updateInterval) clearInterval(updateInterval);
            elements.monitorDiv.remove();
        });
        
        elements.input.focus();
    }

    async startMonitoring(elements, serverNumber) {
        let previousPlayers = 0;
        const query = new AsaQuery();
        
        const updateServer = async () => {
            try {
                const results = await query
                    .official()
                    .serverNameContains(serverNumber)
                    .max(1)
                    .exec();

                if (results && results.sessions && results.sessions.length > 0) {
                    const server = results.sessions[0];
                    const currentPlayers = server.totalPlayers || 0;
                    
                    elements.playerLabel.textContent = `Players: ${currentPlayers}`;
                    elements.serverName.textContent = server.attributes?.SESSIONNAME_s || 'Unknown';
                    
                    if (currentPlayers !== previousPlayers) {
                        // 플레이어 수가 증가했는지 감소했는지 확인
                        const increased = currentPlayers > previousPlayers;
                        this.flashElement(elements.playerLabel, increased);
                        this.flashElement(elements.serverName, increased);
                        previousPlayers = currentPlayers;
                    }
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };

        await updateServer();
        return setInterval(updateServer, 5000);
    }

    flashElement(element, increased) {
        let flashCount = 0;
        const flash = () => {
            flashCount++;
            // increased가 true면 빨간색, false면 파란색
            element.style.color = flashCount % 2 ? (increased ? '#FF0000' : '#0000FF') : '#FFFF00';
            if (flashCount < 10) {
                setTimeout(flash, 500);
            } else {
                element.style.color = '#FFFF00';
            }
        };
        flash();
    }
}

class TimerMonitor {
    constructor() {
        this.timerInterval = null;
        this.timerLabel = null;
        this.timerContainer = null;
        
        document.getElementById('timerBtn').addEventListener('click', () => this.toggleTimer());
    }

    toggleTimer() {
        const existingInput = document.querySelector('.timer-input');
        if (existingInput) {
            existingInput.remove();
            return;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'server-input timer-input';
        input.placeholder = 'min[:sec]';
        input.style.width = '50px';
        
        // titlebar에 추가
        const titlebar = document.getElementById('titlebar');
        titlebar.appendChild(input);  // 맨 오른쪽에 추가
        input.focus();

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const inputValue = input.value;
                let totalSeconds;

                if (inputValue.includes(':')) {
                    const [minutes, seconds] = inputValue.split(':').map(num => parseInt(num));
                    if (!isNaN(minutes) && !isNaN(seconds) && seconds < 60) {
                        totalSeconds = (minutes * 60) + seconds;
                    }
                } else {
                    const minutes = parseInt(inputValue);
                    if (!isNaN(minutes)) {
                        totalSeconds = minutes * 60;
                    }
                }

                if (totalSeconds && totalSeconds > 0) {
                    this.startTimer(totalSeconds);
                    input.remove();
                }
            }
        });
    }

    startTimer(totalSeconds) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // 기존 타이머 컨테이너가 있으면 제거
        if (this.timerContainer) {
            this.timerContainer.remove();
        }

        // 타이머 컨테이너 생성
        this.timerContainer = document.createElement('div');
        this.timerContainer.style.display = 'flex';
        this.timerContainer.style.alignItems = 'center';
        this.timerContainer.style.marginLeft = '5px';

        // 타이머 레이블 생성
        this.timerLabel = document.createElement('span');
        this.timerLabel.style.color = '#FF0000';
        this.timerLabel.style.marginRight = '5px';
        this.timerLabel.style.fontSize = '14px';

        // 타이머 제거 버튼
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.style.color = '#FFFF00';
        removeBtn.style.marginLeft = '2px';
        removeBtn.addEventListener('click', () => {
            clearInterval(this.timerInterval);
            this.timerContainer.remove();
            this.timerContainer = null;
            this.timerLabel = null;
        });

        // 컨테이너에 요소들 추가
        this.timerContainer.appendChild(this.timerLabel);
        this.timerContainer.appendChild(removeBtn);
        
        // titlebar 맨 오른쪽에 추가
        const titlebar = document.getElementById('titlebar');
        titlebar.appendChild(this.timerContainer);
        
        const updateDisplay = () => {
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            this.timerLabel.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        updateDisplay();
        this.timerInterval = setInterval(() => {
            totalSeconds--;
            if (totalSeconds < 0) {
                totalSeconds = 15 * 60; // 15분으로 리셋
            }
            updateDisplay();
        }, 1000);
    }
}

// ServerMonitor 인스턴스 생성 후에 TimerMonitor 인스턴스 생성
new ServerMonitor();
new TimerMonitor();