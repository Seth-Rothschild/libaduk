import { browser } from '$app/environment';

function generateGuestId() {
	const digits = Math.floor(Math.random() * 10000)
		.toString()
		.padStart(4, '0');
	return `Guest${digits}`;
}

export function getGuestId() {
	if (!browser) return 'Guest';
	let id = localStorage.getItem('guest-id');
	if (!id) {
		id = generateGuestId();
		localStorage.setItem('guest-id', id);
	}
	return id;
}
