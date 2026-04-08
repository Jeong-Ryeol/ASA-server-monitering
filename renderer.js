const { ipcRenderer } = require('electron');

class ServerMonitor {
    constructor() {
        this.container = document.getElementById('serverList');
        this.monitors = [];

        const interactiveElements = ['#addServer', '#closeApp', '#timerBtn', '.remove-btn', '.server-input', '.type-btn'];

        document.addEventListener('mouseover', (e) => {
            if (document.activeElement.classList.contains('server-input')) {
                ipcRenderer.send('enable-mouse');
                return;
            }
            if (interactiveElements.some(selector => e.target.closest(selector))) {
                ipcRenderer.send('enable-mouse');
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (!document.activeElement.classList.contains('server-input')) {
                if (interactiveElements.some(selector => e.target.closest(selector))) {
                    ipcRenderer.send('disable-mouse');
                }
            }
        });

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
        document.getElementById('closeApp').addEventListener('click', () => ipcRenderer.send('quit-app'));
    }

    createMonitorElement(isOfficial) {
        const monitorDiv = document.createElement('div');
        monitorDiv.className = 'monitor';

        const typeTag = document.createElement('span');
        typeTag.className = 'server-type';
        typeTag.textContent = isOfficial ? 'O' : 'U';
        typeTag.style.color = isOfficial ? '#00FF00' : '#FF8800';
        typeTag.style.marginRight = '5px';
        typeTag.style.fontSize = '12px';
        typeTag.style.fontWeight = 'bold';

        const playerLabel = document.createElement('span');
        playerLabel.className = 'player-count';
        playerLabel.textContent = 'Players: 0';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'server-input';
        input.placeholder = isOfficial ? '#' : 'Name';
        if (!isOfficial) input.style.width = '100px';

        const serverName = document.createElement('span');
        serverName.className = 'server-name';
        serverName.textContent = 'NONE';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';

        monitorDiv.appendChild(typeTag);
        monitorDiv.appendChild(playerLabel);
        monitorDiv.appendChild(input);
        monitorDiv.appendChild(serverName);
        monitorDiv.appendChild(removeBtn);

        return { monitorDiv, playerLabel, input, serverName, removeBtn };
    }

    async addMonitor() {
        // Search input row (no official/unofficial selection needed)
        const searchDiv = document.createElement('div');
        searchDiv.className = 'monitor';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'server-input';
        searchInput.placeholder = 'Server name or #';
        searchInput.style.width = '150px';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'remove-btn';
        cancelBtn.textContent = '×';
        cancelBtn.addEventListener('click', () => {
            searchDiv.remove();
            const oldResults = document.getElementById('search-results');
            if (oldResults) oldResults.remove();
        });
        searchDiv.appendChild(searchInput);
        searchDiv.appendChild(cancelBtn);
        this.container.appendChild(searchDiv);
        searchInput.focus();

        searchInput.addEventListener('keypress', async (e) => {
            if (e.key !== 'Enter') return;
            const searchText = searchInput.value;
            if (!searchText) return;

            const oldResults = document.getElementById('search-results');
            if (oldResults) oldResults.remove();

            searchInput.style.borderColor = '#FFFF00';
            const result = await ipcRenderer.invoke('search-servers', { searchText });
            if (!result.success || result.servers.length === 0) {
                searchInput.style.borderColor = '#FF0000';
                return;
            }

            const listDiv = document.createElement('div');
            listDiv.id = 'search-results';

            result.servers.forEach(server => {
                const row = document.createElement('div');
                row.className = 'search-result';

                const name = document.createElement('span');
                name.className = 'result-name';
                name.textContent = server.name;

                const players = document.createElement('span');
                players.className = 'result-players';
                players.textContent = `${server.players}/${server.maxPlayers}`;

                row.appendChild(name);
                row.appendChild(players);
                listDiv.appendChild(row);

                row.addEventListener('click', () => {
                    searchDiv.remove();
                    listDiv.remove();

                    const elements = this.createMonitorElement(false);
                    this.container.appendChild(elements.monitorDiv);
                    elements.input.style.display = 'none';
                    elements.playerLabel.textContent = `Players: ${server.players}`;
                    elements.serverName.textContent = server.name;

                    const interval = this.startRefreshing(elements, server.name);

                    elements.removeBtn.addEventListener('click', () => {
                        if (interval) clearInterval(interval);
                        elements.monitorDiv.remove();
                    });
                });
            });

            this.container.appendChild(listDiv);
        });
    }

    startRefreshing(elements, serverName) {
        let previousPlayers = 0;

        const update = async () => {
            try {
                const result = await ipcRenderer.invoke('refresh-server', { serverName });
                if (!result.success) return;

                const currentPlayers = result.players;
                elements.playerLabel.textContent = `Players: ${currentPlayers}`;
                elements.serverName.textContent = result.name;
                elements.serverName.style.color = '#FFFF00';

                if (currentPlayers !== previousPlayers) {
                    const increased = currentPlayers > previousPlayers;
                    this.flashElement(elements.playerLabel, increased);
                    this.flashElement(elements.serverName, increased);
                    previousPlayers = currentPlayers;
                }
            } catch (e) {}
        };

        return setInterval(update, 5000);
    }

    flashElement(element, increased) {
        let flashCount = 0;
        const flash = () => {
            flashCount++;
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

        const titlebar = document.getElementById('titlebar');
        titlebar.appendChild(input);
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

        if (this.timerContainer) {
            this.timerContainer.remove();
        }

        this.timerContainer = document.createElement('div');
        this.timerContainer.style.display = 'flex';
        this.timerContainer.style.alignItems = 'center';
        this.timerContainer.style.marginLeft = '5px';

        this.timerLabel = document.createElement('span');
        this.timerLabel.style.color = '#FF0000';
        this.timerLabel.style.marginRight = '5px';
        this.timerLabel.style.fontSize = '14px';

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

        this.timerContainer.appendChild(this.timerLabel);
        this.timerContainer.appendChild(removeBtn);

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
                totalSeconds = 15 * 60;
            }
            updateDisplay();
        }, 1000);
    }
}

// No login needed - CDN method
new ServerMonitor();
new TimerMonitor();
