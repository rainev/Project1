export const fcfs = (processes) => {
  let currentTime = 0;
  let timeline = [];
  const result = processes.map((proc, i) => {
    const arrival = parseInt(proc.arrivalTime, 10);
    const burst = parseInt(proc.burstTime, 10);

    const startTime = Math.max(currentTime, arrival);
    const endTime = startTime + burst;
    const waitTime = startTime - arrival;
    // track here
    timeline.push({ process: `P${i + 1}`, start: startTime, end: endTime });

    currentTime = endTime;

    return {
      startTime,
      endTime,
      waitTime,
    };
  });
  return { result, timeline };
};

export const nonPreEmptiveSJF = (processes) => {
  const procList = [...processes].map((p, i) => ({ ...p, index: i }));
  const result = [];
  let currentTime = 0;
  let timeline = [];

  while (procList.length > 0) {
    const available = procList.filter(p => parseInt(p.arrivalTime, 10) <= currentTime);

    if (available.length === 0) {
      currentTime++;
      continue;
    }

    available.sort((a, b) => parseInt(a.burstTime, 10) - parseInt(b.burstTime, 10));
    const selected = available[0];
    const arrival = parseInt(selected.arrivalTime, 10);
    const burst = parseInt(selected.burstTime, 10);
    const startTime = Math.max(currentTime, arrival);
    const endTime = startTime + burst;
    const waitTime = startTime - arrival;

    result[selected.index] = { startTime, endTime, waitTime };
    // track here
    timeline.push({ process: `P${selected.index + 1}`, start: startTime, end: endTime });
    procList.splice(procList.findIndex(p => p.index === selected.index), 1);
    currentTime = endTime;
  }

  return { result, timeline };
};

export const preEmptiveSJF = (processes) => {
  const n = processes.length;
  const arrival = processes.map(p => parseInt(p.arrivalTime, 10));
  const burst = processes.map(p => parseInt(p.burstTime, 10));
  const remaining = [...burst];
  const startTimes = Array(n).fill(null);
  const endTimes = Array(n).fill(0);
  const waitTimes = Array(n).fill(0);
  const timeline = [];
  let time = 0, complete = 0;

  while (complete < n) {
    let idx = -1;
    for (let i = 0; i < n; i++) {
      if (arrival[i] <= time && remaining[i] > 0) {
        if (idx === -1 || remaining[i] < remaining[idx]) {
          idx = i;
        }
      }
    }

    if (idx !== -1) {
      if (startTimes[idx] === null) startTimes[idx] = time;
      remaining[idx]--;
      // track here
      const currentProcess = `P${idx + 1}`;
      if (timeline.length === 0 || timeline[timeline.length - 1].process !== currentProcess) {
        timeline.push({ process: currentProcess, start: time, end: time + 1 });
      } else {
        timeline[timeline.length - 1].end++;
      }

      if (remaining[idx] === 0) {
        complete++;
        endTimes[idx] = time + 1;
        waitTimes[idx] = endTimes[idx] - arrival[idx] - burst[idx];
      }
      time++;
    } else {
      // track here
      if (timeline.length === 0 || timeline[timeline.length - 1].process !== 'Idle') {
        timeline.push({ process: 'Idle', start: time, end: time + 1 });
      } else {
        timeline[timeline.length - 1].end++;
      }
      time++;
    }
  }

  const result = startTimes.map((startTime, i) => ({
    startTime,
    endTime: endTimes[i],
    waitTime: waitTimes[i],
  }));

  return { result, timeline };
};

export const roundRobin = (processes, quantum = 2) => {
  const n = processes.length;
  const queue = [];
  const arrival = processes.map(p => parseInt(p.arrivalTime, 10));
  const burst = processes.map(p => parseInt(p.burstTime, 10));
  const remaining = [...burst];
  const startTimes = Array(n).fill(null);
  const endTimes = Array(n).fill(0);
  const waitTimes = Array(n).fill(0);
  let time = 0, complete = 0;
  const arrived = new Set();
  const timeline = [];

  while (complete < n) {
    for (let i = 0; i < n; i++) {
      if (arrival[i] <= time && !arrived.has(i)) {
        queue.push(i);
        arrived.add(i);
      }
    }

    if (queue.length === 0) {
      // CPU is idle
      // track here
      if (timeline.length === 0 || timeline[timeline.length - 1].process !== 'Idle') {
        timeline.push({ process: 'Idle', start: time, end: time + 1 });
      } else {
        timeline[timeline.length - 1].end++;
      }
      time++;
      continue;
    }

    const i = queue.shift();
    if (startTimes[i] === null) startTimes[i] = time;
    const run = Math.min(quantum, remaining[i]);
    // track here
    const currentProcess = `P${i + 1}`;
    timeline.push({ process: currentProcess, start: time, end: time + run });

    time += run;
    remaining[i] -= run;

    for (let j = 0; j < n; j++) {
      if (arrival[j] <= time && !arrived.has(j)) {
        queue.push(j);
        arrived.add(j);
      }
    }

    if (remaining[i] > 0) {
      queue.push(i);
    } else {
      endTimes[i] = time;
      waitTimes[i] = endTimes[i] - arrival[i] - burst[i];
      complete++;
    }
  }

  const result = startTimes.map((startTime, i) => ({
    startTime,
    endTime: endTimes[i],
    waitTime: waitTimes[i],
  }));
  return { result, timeline };
};

export const priorityNonPreemptive = (processes, isDescending = false) => {
  const procList = [...processes].map((p, i) => ({ ...p, index: i }));
  const result = [];
  const currentTime = 0;
  let timeline = [];

  while (procList.length > 0) {
    const available = procList.filter(p => parseInt(p.arrivalTime, 10) <= currentTime);
    if (available.length === 0) {
      // track here
      if (timeline.length === 0 || timeline[timeline.length - 1].process !== 'Idle') {
        timeline.push({ process: 'Idle', start: currentTime, end: currentTime + 1 });
      } else {
        timeline[timeline.length - 1].end++;
      }
      currentTime++;
      continue;
    }

    available.sort((a, b) => {
      const pa = parseInt(a.priority, 10);
      const pb = parseInt(b.priority, 10);
      return isDescending ? pb - pa : pa - pb;
    });

    const selected = available[0];
    const arrival = parseInt(selected.arrivalTime, 10);
    const burst = parseInt(selected.burstTime, 10);
    const startTime = Math.max(currentTime, arrival);
    const endTime = startTime + burst;
    const waitTime = startTime - arrival;
    // track here
    timeline.push({ process: `P${selected.index + 1}`, start: startTime, end: endTime });

    result[selected.index] = { startTime, endTime, waitTime };
    procList.splice(procList.findIndex(p => p.index === selected.index), 1);
    currentTime = endTime;
  }

  return { result, timeline };
};

export const priorityPreemptive = (processes, isDescending = false) => {
  const n = processes.length;
  const arrival = processes.map(p => parseInt(p.arrivalTime, 10));
  const burst = processes.map(p => parseInt(p.burstTime, 10));
  const priority = processes.map(p => parseInt(p.priority, 10));
  const remaining = [...burst];
  const startTimes = Array(n).fill(null);
  const endTimes = Array(n).fill(0);
  const waitTimes = Array(n).fill(0);
  const timeline = [];

  let time = 0, complete = 0;

  while (complete < n) {
    let idx = -1;
    for (let i = 0; i < n; i++) {
      if (arrival[i] <= time && remaining[i] > 0) {
        if (
          idx === -1 ||
          (isDescending
            ? priority[i] > priority[idx]
            : priority[i] < priority[idx])
        ) {
          idx = i;
        }
      }
    }

    if (idx !== -1) {
      if (startTimes[idx] === null) startTimes[idx] = time;
      remaining[idx]--;
      // track here
      const currentProcess = `P${idx + 1}`;
      if (timeline.length === 0 || timeline[timeline.length - 1].process !== currentProcess) {
        timeline.push({ process: currentProcess, start: time, end: time + 1 });
      } else {
        timeline[timeline.length - 1].end++;
      }

      if (remaining[idx] === 0) {
        complete++;
        endTimes[idx] = time + 1;
        waitTimes[idx] = endTimes[idx] - arrival[idx] - burst[idx];
      }
      time++;
    } else {
      //track here
      if (timeline.length === 0 || timeline[timeline.length - 1].process !== 'Idle') {
        timeline.push({ process: 'Idle', start: time, end: time + 1 });
      } else {
        timeline[timeline.length - 1].end++;
      }
      time++;
    }
  }
  const result = startTimes.map((startTime, i) => ({
    startTime,
    endTime: endTimes[i],
    waitTime: waitTimes[i],
  }));
  return { result, timeline };
};

const assignToCore = (cores, proc) => {
  let minCoreIndex = 0;
  let minTime = cores[0].length > 0 ? cores[0][cores[0].length - 1].endTime : 0;

  for (let i = 1; i < cores.length; i++) {
    const lastEnd = cores[i].length > 0 ? cores[i][cores[i].length - 1].endTime : 0;
    if (lastEnd < minTime) {
      minTime = lastEnd;
      minCoreIndex = i;
    }
  }

  cores[minCoreIndex].push(proc);
};

export const multicoreFcFs = (processes, numCores) => {
  const sorted = [...processes].map((p, i) => ({ ...p, index: i }))
    .sort((a, b) => parseInt(a.arrivalTime) - parseInt(b.arrivalTime));

  const cores = Array.from({ length: numCores }, () => []);
  const result = Array(processes.length);
  const timeline = Array.from({ length: numCores }, () => []);

  sorted.forEach(proc => assignToCore(cores, proc));

  cores.forEach((core, coreIndex) => {
    let time = 0;
    core.forEach(proc => {
      const arrival = parseInt(proc.arrivalTime);
      const burst = parseInt(proc.burstTime);
      const startTime = Math.max(time, arrival);
      const endTime = startTime + burst;
      const waitTime = startTime - arrival;

      result[proc.index] = { startTime, endTime, waitTime };
      // track here
      timeline[coreIndex].push({
        process: `P${proc.index + 1}`,
        start: startTime,
        end: endTime,
        core: coreIndex,
      });
      time = endTime;
    });
  });

  return { result, timeline };
};

export const multicoreRoundRobin = (processes, quantum, numCores) => {
  const cores = Array.from({ length: numCores }, () => []);
  const result = Array(processes.length);
  const timeline = Array.from({ length: numCores }, () => []);

  processes.forEach((p, i) => assignToCore(cores, { ...p, index: i }));

  cores.forEach((core, coreIndex) => {
    const queue = [];
    const arrival = core.map(p => parseInt(p.arrivalTime));
    const burst = core.map(p => parseInt(p.burstTime));
    const remaining = [...burst];
    const startTimes = Array(core.length).fill(null);
    const endTimes = Array(core.length).fill(0);
    const waitTimes = Array(core.length).fill(0);
    const arrived = new Set();
    let time = 0, complete = 0;

    while (complete < core.length) {
      for (let i = 0; i < core.length; i++) {
        if (arrival[i] <= time && !arrived.has(i)) {
          queue.push(i);
          arrived.add(i);
        }
      }

      if (queue.length === 0) {
        // track here
        if (
          timeline[coreIndex].length === 0 ||
          timeline[coreIndex][timeline[coreIndex].length - 1].process !== 'Idle'
        ) {
          timeline[coreIndex].push({ process: 'Idle', start: time, end: time + 1, core: coreIndex });
        } else {
          timeline[coreIndex][timeline[coreIndex].length - 1].end++;
        }
        time++;
        continue;
      }

      const i = queue.shift();
      if (startTimes[i] === null) startTimes[i] = time;
      const run = Math.min(quantum, remaining[i]);

      const currentProcess = `P${core[i].index + 1}`;
      timeline[coreIndex].push({ process: currentProcess, start: time, end: time + run, core: coreIndex });

      time += run;
      remaining[i] -= run;

      for (let j = 0; j < core.length; j++) {
        if (arrival[j] <= time && !arrived.has(j)) {
          queue.push(j);
          arrived.add(j);
        }
      }

      if (remaining[i] > 0) {
        queue.push(i);
      } else {
        const idx = core[i].index;
        endTimes[i] = time;
        waitTimes[i] = endTimes[i] - arrival[i] - burst[i];
        result[idx] = {
          startTime: startTimes[i],
          endTime: endTimes[i],
          waitTime: waitTimes[i]
        };
        complete++;
      }
    }
  });

  return { result, timeline };
};

export const multicoreNonPreemptiveSJF = (processes, numCores) => {
  const sorted = [...processes].map((p, i) => ({ ...p, index: i }))
    .sort((a, b) => parseInt(a.arrivalTime) - parseInt(b.arrivalTime));

  const cores = Array.from({ length: numCores }, () => []);
  const result = Array(processes.length);
  const timeline = Array.from({ length: numCores }, () => []);

  sorted.forEach(proc => assignToCore(cores, proc));

  cores.forEach((core, coreIndex) => {
    let time = 0;
    const queue = [...core];

    while (queue.length > 0) {
      const available = queue.filter(p => parseInt(p.arrivalTime) <= time);
      if (available.length === 0) {
        // track here
        if (
          timeline[coreIndex].length === 0 ||
          timeline[coreIndex][timeline[coreIndex].length - 1].process !== 'Idle'
        ) {
          timeline[coreIndex].push({ process: 'Idle', start: time, end: time + 1, core: coreIndex });
        } else {
          timeline[coreIndex][timeline[coreIndex].length - 1].end++;
        }
        time++;
        continue;
      }

      available.sort((a, b) => parseInt(a.burstTime) - parseInt(b.burstTime));
      const selected = available[0];

      const arrival = parseInt(selected.arrivalTime);
      const burst = parseInt(selected.burstTime);
      const startTime = Math.max(time, arrival);
      const endTime = startTime + burst;
      const waitTime = startTime - arrival;

      result[selected.index] = { startTime, endTime, waitTime };

      timeline[coreIndex].push({
        process: `P${selected.index + 1}`,
        start: startTime,
        end: endTime,
        core: coreIndex
      });

      time = endTime;
      queue.splice(queue.findIndex(p => p.index === selected.index), 1);
    }
  });

  return { result, timeline };
};

export const multicorePriority = (processes, numCores, isDescending = false) => {
  const sorted = [...processes].map((p, i) => ({ ...p, index: i }))
    .sort((a, b) => parseInt(a.arrivalTime) - parseInt(b.arrivalTime));

  const cores = Array.from({ length: numCores }, () => []);
  const result = Array(processes.length);
  const timeline = Array.from({ length: numCores }, () => []);

  sorted.forEach(proc => assignToCore(cores, proc));

  cores.forEach((core, coreIndex) => {
    let time = 0;
    const queue = [...core];

    while (queue.length > 0) {
      const available = queue.filter(p => parseInt(p.arrivalTime) <= time);
      if (available.length === 0) {
        // track here
        if (
          timeline[coreIndex].length === 0 ||
          timeline[coreIndex][timeline[coreIndex].length - 1].process !== 'Idle'
        ) {
          timeline[coreIndex].push({ process: 'Idle', start: time, end: time + 1, core: coreIndex });
        } else {
          timeline[coreIndex][timeline[coreIndex].length - 1].end++;
        }
        time++;
        continue;
      }

      available.sort((a, b) => {
        const pa = parseInt(a.priority);
        const pb = parseInt(b.priority);
        return isDescending ? pb - pa : pa - pb;
      });

      const selected = available[0];
      const arrival = parseInt(selected.arrivalTime);
      const burst = parseInt(selected.burstTime);
      const startTime = Math.max(time, arrival);
      const endTime = startTime + burst;
      const waitTime = startTime - arrival;

      result[selected.index] = { startTime, endTime, waitTime };

      timeline[coreIndex].push({
        process: `P${selected.index + 1}`,
        start: startTime,
        end: endTime,
        core: coreIndex
      });

      time = endTime;
      queue.splice(queue.findIndex(p => p.index === selected.index), 1);
    }
  });

  return { result, timeline };
};