import {
    fcfs, nonPreEmptiveSJF, preEmptiveSJF, roundRobin,
    priorityNonPreemptive, priorityPreemptive,
    multicoreFcFs, multicoreRoundRobin, multicoreNonPreemptiveSJF,
    multicorePriority
} from './handle_values';

export const validateScheduleResult = () => {
    const processes = [
        { arrivalTime: 0, burstTime: 5, priority: 3 },
        { arrivalTime: 1, burstTime: 3, priority: 1 },
        { arrivalTime: 2, burstTime: 8, priority: 4 },
        { arrivalTime: 3, burstTime: 6, priority: 2 },
        { arrivalTime: 4, burstTime: 2, priority: 5 },
    ];

    
    const quantum = 2;
    const numCores = 2;
    const isDescending = false;

    const expectedResults = {
        FCFS: [
            { id: 1, start: 0, end: 5, wait: 0 },
            { id: 2, start: 5, end: 8, wait: 4 },
            { id: 3, start: 8, end: 16, wait: 6 },
            { id: 4, start: 16, end: 22, wait: 13 },
            { id: 5, start: 22, end: 24, wait: 18 },
        ],
        NonPreemptiveSJF: [
            { id: 1, start: 0, end: 5, wait: 0 },
            { id: 5, start: 5, end: 7, wait: 1 },
            { id: 2, start: 7, end: 10, wait: 6 },
            { id: 4, start: 10, end: 16, wait: 7 },
            { id: 3, start: 16, end: 24, wait: 14 },
        ],
        PreemptiveSJF: [
            { id: 1, start: 0, end: 11, wait: 6 },
            { id: 2, start: 1, end: 4, wait: 0 },
            { id: 3, start: 15, end: 23, wait: 13 },
            { id: 4, start: 4, end: 10, wait: 1 },
            { id: 5, start: 11, end: 13, wait: 7 },
        ],
        RoundRobin: [
            { id: 1, start: 0, end: 16, wait: 11 },
            { id: 2, start: 2, end: 13, wait: 9 },
            { id: 3, start: 4, end: 24, wait: 14 },
            { id: 4, start: 8, end: 22, wait: 13 },
            { id: 5, start: 10, end: 12, wait: 6 },
        ],
        PriorityNonPreemptive: [
            { id: 2, start: 0, end: 3, wait: 0 },
            { id: 4, start: 3, end: 9, wait: 0 },
            { id: 1, start: 9, end: 14, wait: 9 },
            { id: 3, start: 14, end: 22, wait: 12 },
            { id: 5, start: 22, end: 24, wait: 18 },
        ],
        PriorityPreemptive: [
            { id: 2, start: 1, end: 4, wait: 0 },
            { id: 4, start: 4, end: 10, wait: 1 },
            { id: 1, start: 0, end: 14, wait: 9 },
            { id: 3, start: 14, end: 22, wait: 12 },
            { id: 5, start: 22, end: 24, wait: 18 },
        ],
        MulticoreFCFS: [
            { id: 1, start: 0, end: 5, wait: 0 },
            { id: 2, start: 1, end: 4, wait: 0 },
            { id: 3, start: 5, end: 13, wait: 3 },
            { id: 4, start: 4, end: 10, wait: 1 },
            { id: 5, start: 10, end: 12, wait: 6 },
        ],
        MulticoreRoundRobin: [
            { id: 1, start: 0, end: 13, wait: 8 },
            { id: 2, start: 1, end: 9, wait: 5 },
            { id: 3, start: 5, end: 21, wait: 11 },
            { id: 4, start: 4, end: 18, wait: 9 },
            { id: 5, start: 9, end: 11, wait: 5 },
        ],
        MulticoreNonPreemptiveSJF: [
            { id: 1, start: 0, end: 5, wait: 0 },
            { id: 5, start: 5, end: 7, wait: 1 },
            { id: 2, start: 7, end: 10, wait: 6 },
            { id: 4, start: 10, end: 16, wait: 7 },
            { id: 3, start: 16, end: 24, wait: 14 },
        ],
        MulticorePriority: [
            { id: 2, start: 1, end: 4, wait: 0 },
            { id: 4, start: 4, end: 10, wait: 1 },
            { id: 1, start: 0, end: 14, wait: 9 },
            { id: 3, start: 14, end: 22, wait: 12 },
            { id: 5, start: 22, end: 24, wait: 18 },
        ],
    };

    const actualResults = {
        FCFS: fcfs(processes),
        NonPreemptiveSJF: nonPreEmptiveSJF(processes),
        PreemptiveSJF: preEmptiveSJF(processes),
        RoundRobin: roundRobin(processes, quantum),
        PriorityNonPreemptive: priorityNonPreemptive(processes, isDescending),
        PriorityPreemptive: priorityPreemptive(processes, isDescending),
        MulticoreFCFS: multicoreFcFs(processes, numCores),
        MulticoreRoundRobin: multicoreRoundRobin(processes, quantum, numCores),
        MulticoreNonPreemptiveSJF: multicoreNonPreemptiveSJF(processes, numCores),
        MulticorePriority: multicorePriority(processes, numCores, isDescending),
    };

    const matchResults = (expected, actual) => {
        if (expected.length !== actual.length) return false;
        const byId = (a, b) => a.id - b.id;
        expected.sort(byId);
        actual.sort(byId);
        return expected.every((e, i) =>
            e.start === actual[i].start &&
            e.end === actual[i].end &&
            e.wait === actual[i].wait
        );
    };

    Object.keys(actualResults).forEach((algo) => {
        const result = actualResults[algo];
        const expected = expectedResults[algo];
        const isValid = matchResults(expected, result);
        console.log(`${algo}: ${isValid ? '✔ correct' : '✘ incorrect'}`);
    });
};

