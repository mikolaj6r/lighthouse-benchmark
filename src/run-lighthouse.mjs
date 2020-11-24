import lighthouse from 'lighthouse';
import analyze from  "./analyze.mjs";
import compare from "./compare.mjs";
import { PERF_METRICS }  from "./metrics.mjs";
import { URL } from 'url';
import launchPuppeteer from "./launch.mjs";
import { join } from 'path'

function getConfig(arg) {
    
  return import(join(`../config/${arg[0]}`)); //eslint-disable-line
}

async function startLighthouse(url, label) {
    const browser = await launchPuppeteer();
    const res = await lighthouse(url, {
        port: new URL(browser.wsEndpoint()).port,
        output: 'json'
    });
    let metrics = {};
    const lighthouseResponse = res;
    const lhr = lighthouseResponse.lhr;
    PERF_METRICS.forEach(metric => {
        metrics[metric] = lhr.audits[metric].numericValue;
    });
    metrics = {
        ...metrics,
        timestamp: lhr.fetchTime,
        score: lhr.categories.performance.score,
        url: lhr.requestedUrl,
        label
    };
    console.log(metrics);
    browser.close();
    return metrics;
}

async function lighthouseRunner(urls, label, abtest) {
    const totals = [];
    let metrics;
    for (const url of urls) {
        metrics = await startLighthouse(url, label);
        totals.push(metrics);
    }
    const analyzed = await analyze(totals);
    console.log(analyzed);
    if (abtest) {
        const compared = await compare(analyzed);
        console.log(compared);
    }

    return {
        totals,
        analyzed
    }
}

async function runAll(suites) {
    const results = [];

    for (const suite of suites) {
        const result = await lighthouseRunner(suite.urls, suite.label);
        results.push(result);
    }

    return results;
}

async function run(suite, abtest) {
    const result = await lighthouseRunner(suite.urls, suite.label, abtest);
    return result;
}

export default function runLighthouse(args) {
    let benchmark;
    let url;
    if (args.length >= 1 && args.length !== 2) {
        if (args[0].includes('http')) {
            url = args[0];
            let suite = {};
            let abtest;
            if (args[2]) {
                // a/b test mode
                abtest = true;
                benchmark = parseInt(args[2], 10);
                const aurls = new Array(benchmark).fill(args[0]);
                const burls = new Array(benchmark).fill(args[1]);
                suite = {
                    label: 'benchmark',
                    urls: aurls.concat(burls)
                };
            } else {
                // single url mode
                suite = {
                    label: url,
                    urls: [url]
                };
            }
            return run(suite, abtest);
        } else {
            return runAll(getConfig(args)); // complete list
        }
    } else if (args.length === 2) {
        // benchmark or subset
        benchmark = args[1] && parseInt(args[1], 10);
        if (benchmark && args[0] && args[0].includes('http')) {
            // benchmark
            url = args[0];
            const suite = {
                label: 'benchmark',
                urls: new Array(benchmark).fill(url)
            };
            return run(suite);
        } else {
            // subset of urls
            return run(getConfig(args).filter(p => p.label === args[1])[0], false);
        }
    }
}