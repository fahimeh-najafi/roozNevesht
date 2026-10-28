const normalize = (value) => value.normalize('NFC').toLowerCase();

export function filterWords(words, query) {
  const search = normalize(query.trim());
  return words.filter((word) => ['norsk', 'english', 'farsi'].some((field) => normalize(word[field]).includes(search)));
}
