// Section navigation
let otherSection = document.getElementById('intro-carousel');
let currentSection =  document.getElementById('data-story');
function switchSection() {
	let swapTemp = otherSection;
	otherSection = currentSection;
	currentSection = swapTemp;

	currentSection.scrollIntoView({
		behavior: 'smooth'
	});
}

// Slideshow / carousel
new Flickity(document.getElementById('flickity'), {
	on: { change: (slideNumber) => {
		if (slideNumber === 5) {
			document.getElementById('intro-exit').innerHTML = 'done';
            document.getElementById('intro-exit').style.color = '#C31354';
		} else {
			document.getElementById('intro-exit').innerHTML = 'skip';
			document.getElementById('intro-exit').style.color = '#000000';
		}
	}}
});

// Only default to the tutorial screen on first load
webBrowser.storage.local.get('seenTutorial', ({ seenTutorial }) => {
	if (!seenTutorial) {
		switchSection();
		webBrowser.storage.local.set({ seenTutorial:true });
	}
})

document.getElementById('intro-exit').addEventListener('click', switchSection);
document.getElementById('goto-intro').addEventListener('click', switchSection);

function convertMSToNiceTimeString(ms) {
	let seconds = ms / 1000;
	let days = seconds / (24 * 3600);
	let hours = seconds / 3600;
	let minutes = seconds / 60;

	if (days > 1) {
		return `${days.toFixed(2)} days`;
	}
	if (hours > 1) {
		return `${hours.toFixed(2)} hours`;
	}
	if (minutes > 1) {
		return `${Math.round(minutes)} minutes`;
	}
	if (seconds > 1) {
		return `${Math.round(seconds)} seconds`;
	}
	return `${ms}ms`;
}

getStats();
async function getStats() {
	const originStats = await loadOriginStats();

	if (originStats && originStats.totalVisits > 0) {
		document.getElementById('monetized-time-data').innerHTML = convertMSToNiceTimeString(originStats.totalMonetizedTimeSpent);

		if (originStats.totalSentAssetsMap?.XRP?.amount > 0) {
			const sentXRP = originStats.totalSentAssetsMap.XRP;
			const actualAmount = sentXRP.amount * 10**(-sentXRP.assetScale);
			document.getElementById('monetized-sent-data').innerHTML = actualAmount.toFixed(3) + '<span style="font-size: 12px;">XRP</span>';
		} else {
			document.getElementById('monetized-sent-text').innerHTML = 'if you were using <a href="https://www.coil.com/">Coil</a> you would have sent '
			document.getElementById('monetized-sent-data').innerHTML = '$' + getEstimatedPaymentForTimeInUSD(originStats.totalMonetizedTimeSpent) + '<span style="font-size: 12px;">USD</span>';
		}

		const monetizedTimePercent = getMonetizedTimeSpentPercent(originStats);
		if (monetizedTimePercent) {
			document.getElementById('monetized-percent-data').innerHTML = monetizedTimePercent+'%';
		} else {
			// TODO: ADD A CHANGE OF TEXT!
			document.getElementById('monetized-percent-data').innerHTML = '0%';
		}
	} else {
		document.getElementById('info-container').innerHTML = `You haven't visited any websites yet! What are you waiting for? Get out there and explore the wild wild web.`;
	}

	const sentXRPtotal = calculateTotalSentXRP();

	if (sentXRPtotal > 0) {
		const needsLoveContainer = document.getElementById('sites-need-love-container');
		const needsLoveTitle = document.createElement('h1');
		needsLoveTitle.title = "These are sites which you visit often, but do not spend much time on.";
		needsLoveTitle.innerHTML = "These monetized sites could use ♥️";

		const needLoveOrigins = await getTopOriginsThatNeedSomeLove(3);
		const needLoveSitesEl = document.createElement("span");

		needsLoveContainer.appendChild(needsLoveTitle);
		needsLoveContainer.appendChild(needLoveSitesEl);

		if (needLoveOrigins.length > 0) {
			for (const originData of needLoveOrigins) {
				if ((originData.faviconSource) && (originData.faviconSource !== "")) {
					const faviconEl = createFaviconImgElement(originData.faviconSource);
					faviconEl.addEventListener("click", () => {
						webBrowser.tabs.create({ url: originData.origin });
					}, false);

					needLoveSitesEl.appendChild(faviconEl);
				}

				const linkEl = document.createElement('a');
				linkEl.href = originData.origin;

				// strip 'https://' or 'http://' and 'www.' from the beginning of the origin
				linkEl.innerHTML = originData.origin.replace(/^(https?:\/\/)(www\.)?/, "");

				needLoveSitesEl.appendChild(linkEl);
				const brEl = document.createElement('br');
				needLoveSitesEl.appendChild(brEl);
			}
		} else {
			const el = document.createElement('span');
			el.innerHTML = 'No sites visited yet!';

			needLoveSitesEl.appendChild(el);
		}
	} else {
		const needsLoveContainer = document.getElementById("sites-need-love-container");
		hideElement(needsLoveContainer);
	}

	// Make all links in extension popup clickable
	var links = document.getElementsByTagName("a");

	for (const link of Array.from(links)) {
		if (link.id !== 'goto-intro') {
			link.addEventListener("click", () => {
				webBrowser.tabs.create({ url: link.href });
			}, false);
		}
	}

	// Top sites visualization with circles
	const topOrigins = await getTopOriginsByTimeSpent(6);
	let circleWeights = [];
	for (const originData of topOrigins) {
		const timeSpent = originData?.originVisitData.timeSpentAtOrigin;
		circleWeights.push(timeSpent);
	}

	// Circles
	const CIRCLE_COLORS = ['#F96060', '#42D2B8', '#92DEFF', '#FFF27B', '#9F88FC'];

	const circleContainer = document.getElementById('circle-container');
	const CIRCLE_MARGIN_SIZE = 10; // This is 2 * .circle margin
	const CIRCLE_PADDING_SIZE = 24; // This is 2 * .circle padding
	const CIRCLE_BORDER_SIZE = 6; // This is 2 * .circle:hover border
	const square = {
		height: circleContainer.clientHeight - (CIRCLE_MARGIN_SIZE + CIRCLE_PADDING_SIZE) - CIRCLE_BORDER_SIZE - 1,
		width: circleContainer.clientWidth - (CIRCLE_MARGIN_SIZE + CIRCLE_PADDING_SIZE) * circleWeights.length - CIRCLE_BORDER_SIZE - 1
	};

	const circleWeightsSum = circleWeights.reduce((prev, cur) => prev + cur, 0);

	// Ensure that the circles are as big as possible, but not so big they overflow, and in scale with each other.
	const areaNormalizationFactor = Math.min(square.width / circleWeightsSum, square.height / circleWeights[0]);
	circleWeights = circleWeights.map(weight => weight * areaNormalizationFactor);

	for (let i = 0; i < circleWeights.length; i++) {
		const circleEl = document.createElement('div');
		const circleWeight = circleWeights[i];
		const color = CIRCLE_COLORS[i];

		const originData = topOrigins[i];
		const totalSentXRP = calculateTotalSentXRPForOrigin(originData);

		circleEl.className = 'circle';
		circleEl.style.background = color;
		circleEl.style.height = circleWeight + 'px';
		circleEl.style.width = circleWeight + 'px';

		if ((originData.faviconSource) && (originData.faviconSource !== "")) {
			const faviconEl = createFaviconImgElement(originData.faviconSource);
			circleEl.appendChild(faviconEl);
		}

		if (circleWeight > 40) {
			const div = document.createElement('div');
			div.innerHTML = createTopSiteCircleHTML(originData, totalSentXRP);
			circleEl.appendChild(div);
			circleEl.style.fontSize = Math.round(circleWeight / 6) + 'px';
		}

		const detailHTML = createTopSiteDetailHTML(originData, totalSentXRP, originStats);
		circleEl.addEventListener('mouseover', () => showTopSiteDetail(detailHTML, color));
		circleEl.addEventListener('mouseleave', () => hideElement(topSiteDetailEl));
		circleEl.addEventListener("click", () => {
			webBrowser.tabs.create({ url: originData.origin });
		}, false);

		circleContainer.appendChild(circleEl);
	}
}


function createFaviconImgElement(faviconSource) {
	const faviconEl = document.createElement('img');
	faviconEl.src = faviconSource;

	// Set height and width to standard favicon size
	faviconEl.width = 16;
	faviconEl.height = 16;

	// Make favicon round
	faviconEl.style.borderRadius = "50%";

	return faviconEl;
}

function createTopSiteCircleHTML(originData, totalSentXRP) {
	const visitData = originData?.originVisitData;
	if (totalSentXRP > 0) {
		return `${convertMSToNiceTimeString(visitData.timeSpentAtOrigin)}<br>${totalSentXRP.toFixed(3)} XRP<br>${visitData.numberOfVisits} visits`;
	} else {
		return `${convertMSToNiceTimeString(visitData.timeSpentAtOrigin)}<br>${visitData.numberOfVisits} visits`;
	}
}

function createTopSiteDetailHTML(originData, totalSentXRP, originStats) {
	if (!originData || !originStats) return "";

	const origin = originData.origin;
	const visitCount = originData.originVisitData.numberOfVisits;
	const timeSpent = originData.originVisitData.timeSpentAtOrigin;
	const percentTimeSpent = getPercentTimeSpentAtOriginOutOfTotal(originData, originStats);
	const percentVisits = getPercentVisitsToOriginOutOfTotal(originData, originStats);
	let sentPayment = totalSentXRP.toFixed(3);
	let paymentString = "So far, you've sent";

	if (parseFloat(sentPayment) > 0) {
		sentPayment += '<span style="font-size: 12px;">XRP</span>';
	} else {
		paymentString = 'If you were using Coil you would have sent';
		sentPayment = "$" + getEstimatedPaymentForTimeInUSD(timeSpent) + '<span style="font-size: 12px;">USD</span>';
	}

	return `<a href="${origin}" style="color: black; text-decoration: underline;">${origin}</a><br><br>
		You've spent <strong>${convertMSToNiceTimeString(timeSpent)}</strong> here, which is <strong>${percentTimeSpent}%</strong> of your time online.<br><br>
		You've visited <strong>${visitCount} times</strong>, which is <strong>${percentVisits}%</strong> of your total website visits.<br><br>
		${paymentString} <strong>${sentPayment}</strong> to this site.`;
}

const topSiteDetailEl = document.getElementById('top-site-detail');
function showTopSiteDetail(innerHTML, color) {
	topSiteDetailEl.style.zIndex = 1;
	topSiteDetailEl.style.opacity = 1;
	topSiteDetailEl.style.background = color;
	topSiteDetailEl.innerHTML = innerHTML;
}

function hideElement(element) {
	// Make element invisible.
	element.style.opacity = 0;
	// Place element "behind" all other elements so it does not intercept mouse interactions.
	element.style.zIndex = -1;
}
