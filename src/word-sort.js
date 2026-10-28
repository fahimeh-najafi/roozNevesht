const collators = {
  norsk: new Intl.Collator('nb', { sensitivity: 'base' }),
  english: new Intl.Collator('en', { sensitivity: 'base' }),
  farsi: new Intl.Collator('fa', { sensitivity: 'base' }),
};

export function sortWords(words, field, direction) {
  const multiplier = direction === 'descending' ? -1 : 1;
  return [...words].sort((first, second) => {
    const left = first[field].trim();
    const right = second[field].trim();
    if (!left || !right) return Number(!left) - Number(!right);
    return multiplier * collators[field].compare(left, right);
  });
}
