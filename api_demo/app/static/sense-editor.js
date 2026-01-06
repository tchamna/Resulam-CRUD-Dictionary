// ============================================================================
// Sense-First Editor (AGENTS.md compliant)
// ============================================================================

let currentWordEntryId = null;
let currentLanguageId = null;
let senseCounter = 0;

const senseEditorContainer = document.getElementById('sense-editor-container');
const senseEditorClose = document.getElementById('sense-editor-close');
const senseEditorAddSense = document.getElementById('sense-editor-add-sense');
const senseEditorSave = document.getElementById('sense-editor-save');
const senseEditorCancel = document.getElementById('sense-editor-cancel');
const sensesContainer = document.getElementById('senses-container');
const senseEditorResult = document.getElementById('sense-editor-result');
const definitionForm = document.getElementById('definition-form');

// Show sense editor
function showSenseEditor(wordEntryId = null, languageId = null, lemma = '') {
	currentWordEntryId = wordEntryId;
	const languageInput = document.getElementById('language-id');
	currentLanguageId = languageId || (languageInput ? languageInput.value : null);
	
	// Hide legacy form
	if (definitionForm) definitionForm.classList.add('is-hidden');
	
	// Show sense editor
	senseEditorContainer.classList.remove('is-hidden');
	
	// Reset
	sensesContainer.innerHTML = '';
	senseCounter = 0;
	senseEditorResult.innerHTML = '';
	
	const entryIdField = document.getElementById('sense-word-entry-id');
	if (entryIdField) entryIdField.value = wordEntryId || '';

	if (wordEntryId) {
		// Load existing word entry
		loadWordEntry(wordEntryId);
	} else {
		// New entry
		document.getElementById('sense-lemma').value = lemma || '';
		document.getElementById('sense-pos').value = '';
		document.getElementById('sense-pronunciation').value = '';
		document.getElementById('sense-status').value = 'draft';
		addSenseCard();
	}
}

// Load word entry from API
async function loadWordEntry(id) {
	try {
		const response = await fetch(`/dictionary/word-entries/${id}`, {
			headers: {'Authorization': `Bearer ${tokenStore.access}`}
		});
		
		if (!response.ok) throw new Error('Failed to load word entry');
		
		const data = await response.json();
		
		document.getElementById('sense-word-entry-id').value = data.id;
		document.getElementById('sense-lemma').value = data.lemma_raw;
		document.getElementById('sense-pos').value = data.pos || '';
		document.getElementById('sense-pronunciation').value = data.pronunciation || '';
		document.getElementById('sense-status').value = data.status;
		
		// Load senses
		if (data.senses && data.senses.length > 0) {
			data.senses.forEach(sense => addSenseCard(sense));
		} else {
			addSenseCard();
		}
	} catch (error) {
		senseEditorResult.innerHTML = `<div class="error">Error loading entry: ${error.message}</div>`;
	}
}

// Add sense card
function addSenseCard(senseData = null) {
	senseCounter++;
	const senseId = `sense-${senseCounter}`;
	
	const card = document.createElement('div');
	card.className = 'sense-card';
	card.dataset.senseId = senseId;
	card.dataset.senseDbId = senseData?.id || '';
	
	card.innerHTML = `
		<div class="sense-header">
			<h4>Sense ${senseCounter}</h4>
			<button type="button" class="sense-remove ghost small" data-sense="${senseId}">Remove</button>
		</div>
		
		<label>Definition *<textarea class="sense-definition" rows="3" data-clafrica="true" required>${senseData?.definition_text || ''}</textarea></label>
		
		<div class="sense-meta">
			<label>POS<input class="sense-pos" type="text" placeholder="noun, verb..." value="${senseData?.pos || ''}" /></label>
			<label>Register<input class="sense-register" type="text" placeholder="formal, informal..." value="${senseData?.register || ''}" /></label>
			<label>Domain<input class="sense-domain" type="text" placeholder="technical, medical..." value="${senseData?.domain || ''}" /></label>
		</div>
		
		<div class="sense-section">
			<h5>Examples</h5>
			<div class="examples-list" data-sense="${senseId}">
				${senseData?.examples?.map((ex, idx) => renderExample(senseId, ex, idx)).join('') || ''}
			</div>
			<button type="button" class="add-example ghost small" data-sense="${senseId}">+ Add Example</button>
		</div>
		
		<div class="sense-section">
			<h5>Translations</h5>
			<div class="translations-list" data-sense="${senseId}">
				${senseData?.translations?.map((trans, idx) => renderTranslation(senseId, trans, idx)).join('') || ''}
			</div>
			<button type="button" class="add-translation ghost small" data-sense="${senseId}">+ Add Translation</button>
		</div>
		
		<div class="sense-section">
			<h5>Relations (Synonyms/Antonyms)</h5>
			<div class="relations-list" data-sense="${senseId}">
				${senseData?.relations?.map((rel, idx) => renderRelation(senseId, rel, idx)).join('') || ''}
			</div>
			<button type="button" class="add-relation ghost small" data-sense="${senseId}">+ Add Relation</button>
		</div>
	`;
	
	sensesContainer.appendChild(card);
	attachSenseCardListeners(card, senseId);
}

function renderExample(senseId, example, index) {
	return `
		<div class="example-item" data-example-id="${example?.id || ''}">
			<label>Example<input type="text" class="example-text" value="${example?.example_text || ''}" data-clafrica="true" /></label>
			<label>FR<input type="text" class="example-trans-fr" value="${example?.translation_fr || ''}" /></label>
			<label>EN<input type="text" class="example-trans-en" value="${example?.translation_en || ''}" /></label>
			<button type="button" class="remove-example ghost small">×</button>
		</div>
	`;
}

function renderTranslation(senseId, translation, index) {
	return `
		<div class="translation-item" data-translation-id="${translation?.id || ''}">
			<label>Lang<input type="text" class="trans-lang" value="${translation?.lang_code || 'fr'}" maxlength="5" /></label>
			<label>Translation<input type="text" class="trans-text" value="${translation?.translation_text || ''}" /></label>
			<button type="button" class="remove-translation ghost small">×</button>
		</div>
	`;
}

function renderRelation(senseId, relation, index) {
	return `
		<div class="relation-item" data-relation-id="${relation?.id || ''}">
			<label>Type
				<select class="rel-type">
					<option value="synonym" ${relation?.relation_type === 'synonym' ? 'selected' : ''}>Synonym</option>
					<option value="antonym" ${relation?.relation_type === 'antonym' ? 'selected' : ''}>Antonym</option>
					<option value="variant" ${relation?.relation_type === 'variant' ? 'selected' : ''}>Variant</option>
					<option value="hypernym" ${relation?.relation_type === 'hypernym' ? 'selected' : ''}>Hypernym</option>
					<option value="hyponym" ${relation?.relation_type === 'hyponym' ? 'selected' : ''}>Hyponym</option>
				</select>
			</label>
			<label>Word<input type="text" class="rel-text" value="${relation?.fallback_text || ''}" data-clafrica="true" /></label>
			<button type="button" class="remove-relation ghost small">×</button>
		</div>
	`;
}

function attachSenseCardListeners(card, senseId) {
	// Remove sense
	card.querySelector('.sense-remove').addEventListener('click', () => {
		if (confirm('Remove this sense?')) {
			card.remove();
		}
	});
	
	// Add example
	card.querySelector('.add-example').addEventListener('click', () => {
		const list = card.querySelector('.examples-list');
		const div = document.createElement('div');
		div.innerHTML = renderExample(senseId, null, 0);
		list.appendChild(div.firstElementChild);
		attachItemRemoveListeners(list);
	});
	
	// Add translation
	card.querySelector('.add-translation').addEventListener('click', () => {
		const list = card.querySelector('.translations-list');
		const div = document.createElement('div');
		div.innerHTML = renderTranslation(senseId, null, 0);
		list.appendChild(div.firstElementChild);
		attachItemRemoveListeners(list);
	});
	
	// Add relation
	card.querySelector('.add-relation').addEventListener('click', () => {
		const list = card.querySelector('.relations-list');
		const div = document.createElement('div');
		div.innerHTML = renderRelation(senseId, null, 0);
		list.appendChild(div.firstElementChild);
		attachItemRemoveListeners(list);
	});
	
	attachItemRemoveListeners(card);
}

function attachItemRemoveListeners(container) {
	container.querySelectorAll('.remove-example').forEach(btn => {
		btn.onclick = (e) => e.target.closest('.example-item').remove();
	});
	container.querySelectorAll('.remove-translation').forEach(btn => {
		btn.onclick = (e) => e.target.closest('.translation-item').remove();
	});
	container.querySelectorAll('.remove-relation').forEach(btn => {
		btn.onclick = (e) => e.target.closest('.relation-item').remove();
	});
}

// Collect data from UI
function collectWordEntryData() {
	if (!currentLanguageId) {
		throw new Error('Select a language before saving');
	}
	const lemma = document.getElementById('sense-lemma').value.trim();
	if (!lemma) {
		throw new Error('Lemma is required');
	}
	
	const senses = [];
	const senseCards = sensesContainer.querySelectorAll('.sense-card');
	
	senseCards.forEach((card, index) => {
		const definition = card.querySelector('.sense-definition').value.trim();
		if (!definition) {
			throw new Error(`Sense ${index + 1} definition is required`);
		}
		
		const examples = [];
		card.querySelectorAll('.example-item').forEach(item => {
			const text = item.querySelector('.example-text').value.trim();
			if (text) {
				examples.push({
					id: item.dataset.exampleId ? parseInt(item.dataset.exampleId) : null,
					example_text: text,
					translation_fr: item.querySelector('.example-trans-fr').value.trim() || null,
					translation_en: item.querySelector('.example-trans-en').value.trim() || null,
					rank: examples.length + 1
				});
			}
		});
		
		const translations = [];
		card.querySelectorAll('.translation-item').forEach(item => {
			const text = item.querySelector('.trans-text').value.trim();
			const lang = item.querySelector('.trans-lang').value.trim();
			if (text && lang) {
				translations.push({
					id: item.dataset.translationId ? parseInt(item.dataset.translationId) : null,
					lang_code: lang,
					translation_text: text,
					rank: translations.length + 1
				});
			}
		});
		
		const relations = [];
		card.querySelectorAll('.relation-item').forEach(item => {
			const text = item.querySelector('.rel-text').value.trim();
			const type = item.querySelector('.rel-type').value;
			if (text) {
				relations.push({
					id: item.dataset.relationId ? parseInt(item.dataset.relationId) : null,
					relation_type: type,
					fallback_text: text,
					rank: relations.length + 1
				});
			}
		});
		
		senses.push({
			id: card.dataset.senseDbId ? parseInt(card.dataset.senseDbId) : null,
			sense_no: index + 1,
			pos: card.querySelector('.sense-pos').value.trim() || null,
			definition_text: definition,
			register: card.querySelector('.sense-register').value.trim() || null,
			domain: card.querySelector('.sense-domain').value.trim() || null,
			examples,
			translations,
			relations
		});
	});
	
	if (senses.length === 0) {
		throw new Error('At least one sense is required');
	}
	
	return {
		language_id: parseInt(currentLanguageId),
		lemma_raw: lemma,
		pos: document.getElementById('sense-pos').value.trim() || null,
		pronunciation: document.getElementById('sense-pronunciation').value.trim() || null,
		status: document.getElementById('sense-status').value,
		senses
	};
}

// Save word entry
async function saveWordEntry() {
	try {
		senseEditorResult.innerHTML = '<div class="info">Saving...</div>';
		
		const data = collectWordEntryData();
		const entryId = document.getElementById('sense-word-entry-id').value;
		const method = entryId ? 'PUT' : 'POST';
		const url = entryId ? `/dictionary/word-entries/${entryId}` : '/dictionary/word-entries';
		
		const response = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${tokenStore.access}`
			},
			body: JSON.stringify(data)
		});
		
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.detail || 'Save failed');
		}
		
		const result = await response.json();
		senseEditorResult.innerHTML = '<div class="success">✓ Saved successfully!</div>';
		if (typeof fetchWordEntries === 'function') {
			fetchWordEntries();
		}
		
		setTimeout(() => closeSenseEditor(), 1500);
	} catch (error) {
		senseEditorResult.innerHTML = `<div class="error">Error: ${error.message}</div>`;
	}
}

function closeSenseEditor() {
	senseEditorContainer.classList.add('is-hidden');
	currentWordEntryId = null;
	const entryIdField = document.getElementById('sense-word-entry-id');
	if (entryIdField) entryIdField.value = '';
}

// Event listeners
if (senseEditorClose) senseEditorClose.addEventListener('click', closeSenseEditor);
if (senseEditorCancel) senseEditorCancel.addEventListener('click', closeSenseEditor);
if (senseEditorAddSense) senseEditorAddSense.addEventListener('click', () => addSenseCard());
if (senseEditorSave) senseEditorSave.addEventListener('click', saveWordEntry);

// Add button to switch to sense editor from word list
document.addEventListener('click', (e) => {
	if (e.target.classList.contains('edit-sense-first')) {
		e.preventDefault();
		const wordId = e.target.dataset.wordId;
		const languageId = e.target.dataset.languageId;
		showSenseEditor(wordId, languageId);
	}
});

// Expose for external use
window.showSenseEditor = showSenseEditor;
