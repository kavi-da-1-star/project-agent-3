const ENDPOINT = 'https://vibe-proxy-gqv4.onrender.com/v1/chat/completions';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer sk-vibe-summer-2026',
};

const elements = {
  status: document.getElementById('status'),
  error: document.getElementById('error'),
  topicsScreen: document.getElementById('topics-screen'),
  topicList: document.getElementById('topic-list'),
  refreshTopics: document.getElementById('refresh-topics'),
  draftScreen: document.getElementById('draft-screen'),
  chosenTopic: document.getElementById('chosen-topic'),
  draftContent: document.getElementById('draft-content'),
  draftEditor: document.getElementById('draft-editor'),
  paragraphEditors: document.getElementById('paragraph-editors'),
  editDraft: document.getElementById('edit-draft'),
  saveDraft: document.getElementById('save-draft'),
  cancelEdit: document.getElementById('cancel-edit'),
  draftAgain: document.getElementById('draft-again'),
  pickAnother: document.getElementById('pick-another'),
  approveSend: document.getElementById('approve-send'),
  finalScreen: document.getElementById('final-screen'),
  chefSummary: document.getElementById('chef-summary'),
  critiqueList: document.getElementById('critique-list'),
  criticSummary: document.getElementById('critic-summary'),
  finalEssay: document.getElementById('final-essay'),
  recipeText: document.getElementById('recipe-text'),
  wordCount: document.getElementById('word-count'),
  compareToggle: document.getElementById('compare-toggle'),
  comparePane: document.getElementById('compare-pane'),
  compareDraft: document.getElementById('compare-draft'),
  compareFinal: document.getElementById('compare-final'),
  copyFinal: document.getElementById('copy-final'),
  startNew: document.getElementById('start-new'),
};

const state = {
  stage: 'loading',
  topics: [],
  chosenTopic: null,
  draftParagraphs: [],
  draftText: '',
  originalDraft: '',
  recipeText: '',
  finalCritique: [],
  finalEssay: '',
  compareActive: false,
  runningAgent: null,
  lastError: null,
};

const agentPrompts = {
  1: `Agent 01: Ingredient picker: A wild food inventor. Produce exactly 5 crazy ingredient bundles, each on its own numbered line. Each line should include the ingredient bundle and a short one-sentence idea for a dish built from those ingredients. Keep the ideas playful and safe for ages 8-18.`,
  2: `Agent 02: Gourmet chef: A high-end recipe creator. Take the approved ingredient bundle and turn it into a sophisticated recipe description. Include a brief introduction to the dish, a list of ingredients, and a polished method in paragraph form. Return only the recipe text, separated into paragraphs with no headings or labels.`,
  3: `Agent 03: Food critic: A blunt roast reviewer. Read the finalized recipe, then return a short bulleted critique and a final roast verdict. Be very direct and tough on the dish, calling out exactly what feels unbalanced, pretentious, or messy. Keep the take strong and memorable while still avoiding personal insults; focus on the food and cooking choices only. Return the critique bullets first, then a blank line, then the final roast summary text.`,
};

function showElement(element) {
  element.classList.remove('hidden');
}

function hideElement(element) {
  element.classList.add('hidden');
}

function setStatus(agent, action) {
  elements.status.textContent = `${agent} is thinking: ${action}`;
  showElement(elements.status);
}

function clearStatus() {
  hideElement(elements.status);
  elements.status.textContent = '';
}

function showError(message, retryHandler) {
  elements.error.innerHTML = '';
  const text = document.createElement('p');
  text.textContent = message;
  const button = document.createElement('button');
  button.className = 'primary';
  button.textContent = 'Retry';
  button.addEventListener('click', retryHandler);
  elements.error.append(text, button);
  showElement(elements.error);
}

function clearError() {
  hideElement(elements.error);
  elements.error.innerHTML = '';
}

function setStage(stage) {
  state.stage = stage;
  clearStatus();
  clearError();
  elements.topicsScreen.classList.toggle('hidden', stage !== 'topics');
  elements.draftScreen.classList.toggle('hidden', stage !== 'draft');
  elements.finalScreen.classList.toggle('hidden', stage !== 'final');
}

function renderTopics() {
  elements.topicList.innerHTML = '';
  if (!state.topics.length) {
    const placeholder = document.createElement('li');
    placeholder.textContent = 'No topics available yet.';
    elements.topicList.appendChild(placeholder);
    return;
  }
  state.topics.forEach((topic) => {
    const item = document.createElement('li');
    item.textContent = topic;
    item.addEventListener('click', () => selectTopic(topic));
    elements.topicList.appendChild(item);
  });
}

function renderDraft() {
  elements.chosenTopic.textContent = state.chosenTopic || '';
  if (state.draftParagraphs.length === 0) {
    elements.draftContent.innerHTML = '<p>Essay draft will appear here.</p>';
    return;
  }
  elements.draftContent.innerHTML = state.draftParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function renderDraftEditor() {
  elements.paragraphEditors.innerHTML = '';
  state.draftParagraphs.forEach((paragraph, index) => {
    const textarea = document.createElement('textarea');
    textarea.value = paragraph;
    textarea.dataset.index = String(index);
    textarea.disabled = false;
    textarea.readOnly = false;
    textarea.spellcheck = true;
    textarea.addEventListener('input', autoResize);
    elements.paragraphEditors.appendChild(textarea);
    setTimeout(() => autoResize({ target: textarea }), 0);
  });
}

function renderFinal() {
  elements.critiqueList.innerHTML = '';
  state.finalCritique.forEach((note) => {
    const li = document.createElement('li');
    li.textContent = note;
    elements.critiqueList.appendChild(li);
  });
  elements.chefSummary.textContent = state.recipeText
    ? 'The chef took your ingredient idea, dressed it up with elegant cooking steps, and turned it into a polished high-end recipe.'
    : 'The chef is still preparing the recipe.';
  elements.recipeText.innerHTML = state.recipeText
    .split('\n\n')
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
  elements.criticSummary.textContent = state.finalEssay
    ? 'The critic tasted the final dish and roasted it with playful, age-friendly notes that point out what worked and what felt over the top.'
    : 'The critic is still forming the roast.';
  const finalParts = state.finalEssay.split('\n\n');
  elements.finalEssay.innerHTML = finalParts
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
  elements.wordCount.textContent = `Word count: ${countWords(state.finalEssay)}`;
  toggleCompare(state.compareActive);
}

function toggleCompare(enabled) {
  state.compareActive = enabled;
  elements.comparePane.classList.toggle('hidden', !enabled);
  if (!enabled) return;
  elements.compareDraft.textContent = state.draftText || 'No draft available.';
  elements.compareFinal.textContent = state.finalEssay || 'No final essay available.';
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function fetchAgent(agentNumber, promptContent) {
  const agentName = `Agent 0${agentNumber}`;
  state.runningAgent = agentName;
  setStatus(agentName, promptContent.actionText);
  clearError();
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'class-chat-model',
        messages: [{ role: 'user', content: promptContent.prompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from the AI service.');
    }
    clearStatus();
    state.runningAgent = null;
    return content;
  } catch (error) {
    state.runningAgent = null;
    showError(`Error from ${agentName}: ${error.message}`, promptContent.retry);
    throw error;
  }
}

function parseTopics(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^(?:\d+\.|[-*+])\s+(.*)$/);
    if (match) {
      if (current) items.push(current.trim());
      current = match[1];
    } else if (current) {
      current += ' ' + line;
    }
  }
  if (current) items.push(current.trim());

  const topics = items.length ? items : lines;
  return topics
    .map((topic) => topic.replace(/^(?:\d+\.|[-*+]\s*)/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function parseEssayIntoParagraphs(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs;
}

function parseReviewResponse(text) {
  const parts = text.split(/\n\s*\n/);
  if (parts.length < 2) {
    return { critique: [], essay: text.trim() };
  }
  const critiqueBlock = parts[0];
  const essayText = parts.slice(1).join('\n\n').trim();
  const critique = critiqueBlock
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*+\s]*/, '').trim())
    .filter(Boolean);
  return { critique, essay: essayText };
}

async function loadTopics() {
  try {
    const result = await fetchAgent(1, {
      prompt: agentPrompts[1],
      actionText: 'thinking of strong essay topics for ages 8-18',
      retry: loadTopics,
    });
    state.topics = parseTopics(result);
    if (!state.topics.length) {
      throw new Error('The topic list was empty.');
    }
    renderTopics();
    setStage('topics');
  } catch (error) {
    setStage('topics');
  }
}

async function selectTopic(topic) {
  state.chosenTopic = topic;
  state.draftParagraphs = [topic];
  state.draftText = topic;
  state.originalDraft = topic;
  state.recipeText = '';
  state.finalCritique = [];
  state.finalEssay = '';
  elements.chosenTopic.textContent = topic;
  setStage('draft');
  renderDraft();
}

async function createRecipe(ingredientIdea) {
  try {
    const result = await fetchAgent(2, {
      prompt: `${agentPrompts[2]}\n\nIngredient idea:\n${ingredientIdea}`,
      actionText: 'turning your approved idea into a gourmet recipe',
      retry: () => createRecipe(ingredientIdea),
    });
    state.recipeText = result.trim();
    return result.trim();
  } catch (error) {
    return null;
  }
}

function enableDraftEditing() {
  if (state.draftParagraphs.length === 0) return;
  renderDraftEditor();
  hideElement(elements.draftContent);
  showElement(elements.draftEditor);
  const firstEditor = elements.paragraphEditors.querySelector('textarea');
  if (firstEditor) {
    firstEditor.focus();
    firstEditor.setSelectionRange(firstEditor.value.length, firstEditor.value.length);
  }
}

function cancelDraftEditing() {
  hideElement(elements.draftEditor);
  showElement(elements.draftContent);
}

function saveDraftEdits() {
  const textareas = Array.from(elements.paragraphEditors.querySelectorAll('textarea'));
  const paragraphs = textareas.map((textarea) => textarea.value.trim()).filter(Boolean);
  if (!paragraphs.length) {
    alert('Please keep at least one paragraph in the draft.');
    return;
  }
  state.draftParagraphs = paragraphs;
  state.draftText = paragraphs.join('\n\n');
  hideElement(elements.draftEditor);
  showElement(elements.draftContent);
  renderDraft();
}

async function sendToEditor() {
  if (!state.draftText.trim()) {
    showError('Please choose or edit an ingredient idea before sending it to the chef.', () => {});
    return;
  }

  const recipe = await createRecipe(state.draftText);
  if (!recipe) {
    return;
  }

  try {
    const result = await fetchAgent(3, {
      prompt: `${agentPrompts[3]}\n\nRecipe:\n${recipe}`,
      actionText: 'roasting the final dish as a food critic',
      retry: sendToEditor,
    });
    const { critique, essay } = parseReviewResponse(result);
    state.finalCritique = critique;
    state.finalEssay = essay;
    setStage('final');
    renderFinal();
  } catch (error) {
    setStage('draft');
  }
}

function loadMoreIdeas() {
  loadTopics();
}

function pickAnotherTopic() {
  state.chosenTopic = null;
  state.draftParagraphs = [];
  state.draftText = '';
  state.originalDraft = '';
  state.recipeText = '';
  state.finalCritique = [];
  state.finalEssay = '';
  state.compareActive = false;
  elements.compareToggle.checked = false;
  renderDraft();
  setStage('topics');
}

function copyFinalEssay() {
  navigator.clipboard.writeText(state.finalEssay).then(() => {
    alert('Final essay copied to clipboard.');
  });
}

function autoResize(event) {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + 4}px`;
}

function wireEvents() {
  elements.refreshTopics.addEventListener('click', loadMoreIdeas);
  elements.editDraft.addEventListener('click', enableDraftEditing);
  elements.saveDraft.addEventListener('click', saveDraftEdits);
  elements.cancelEdit.addEventListener('click', cancelDraftEditing);
  elements.draftAgain.addEventListener('click', loadMoreIdeas);
  elements.pickAnother.addEventListener('click', pickAnotherTopic);
  elements.approveSend.addEventListener('click', sendToEditor);
  elements.compareToggle.addEventListener('change', (event) => toggleCompare(event.target.checked));
  elements.copyFinal.addEventListener('click', copyFinalEssay);
  elements.startNew.addEventListener('click', () => {
    pickAnotherTopic();
    loadTopics();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  wireEvents();
  loadTopics();
});
