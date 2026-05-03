import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnOrder } from './useColumnOrder';

const TABLE_ID = 'test-table';
const DEFAULT_ORDER = ['a', 'b', 'c'];

function getStorageKey(tableId: string): string {
  return `testmo_columns_${tableId}`;
}

describe('useColumnOrder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns default order when nothing stored', () => {
    const { result } = renderHook(() => useColumnOrder(TABLE_ID, DEFAULT_ORDER));
    expect(result.current.columnOrder).toEqual(DEFAULT_ORDER);
  });

  it('reorders columns and persists to localStorage', () => {
    const { result } = renderHook(() => useColumnOrder(TABLE_ID, DEFAULT_ORDER));

    const newOrder = ['c', 'a', 'b'];
    act(() => {
      result.current.setColumnOrder(newOrder);
    });

    expect(result.current.columnOrder).toEqual(newOrder);
    expect(localStorage.getItem(getStorageKey(TABLE_ID))).toBe(JSON.stringify(newOrder));
  });

  it('restores stored order on mount', () => {
    const storedOrder = ['b', 'c', 'a'];
    localStorage.setItem(getStorageKey(TABLE_ID), JSON.stringify(storedOrder));

    const { result } = renderHook(() => useColumnOrder(TABLE_ID, DEFAULT_ORDER));
    expect(result.current.columnOrder).toEqual(storedOrder);
  });

  it('resets to default', () => {
    const storedOrder = ['b', 'c', 'a'];
    localStorage.setItem(getStorageKey(TABLE_ID), JSON.stringify(storedOrder));

    const { result } = renderHook(() => useColumnOrder(TABLE_ID, DEFAULT_ORDER));
    expect(result.current.columnOrder).toEqual(storedOrder);

    act(() => {
      result.current.resetColumnOrder();
    });

    expect(result.current.columnOrder).toEqual(DEFAULT_ORDER);
    expect(localStorage.getItem(getStorageKey(TABLE_ID))).toBeNull();
  });

  it('ignores invalid stored order (wrong length)', () => {
    localStorage.setItem(getStorageKey(TABLE_ID), JSON.stringify(['a', 'b']));
    const { result } = renderHook(() => useColumnOrder(TABLE_ID, DEFAULT_ORDER));
    expect(result.current.columnOrder).toEqual(DEFAULT_ORDER);
  });

  it('ignores invalid stored order (unknown key)', () => {
    localStorage.setItem(getStorageKey(TABLE_ID), JSON.stringify(['a', 'b', 'x']));
    const { result } = renderHook(() => useColumnOrder(TABLE_ID, DEFAULT_ORDER));
    expect(result.current.columnOrder).toEqual(DEFAULT_ORDER);
  });
});
