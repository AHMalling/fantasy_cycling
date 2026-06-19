import React from "react";
import { render, act } from "@testing-library/react";
import { useRouter } from "next/navigation";
import AutoRefresh from "../../components/AutoRefresh";

function getRefreshMock() {
  const refresh = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ refresh });
  return refresh;
}

function dispatchPhotoNeeded() {
  act(() => {
    window.dispatchEvent(new CustomEvent("rider-photo-needed"));
  });
}

describe("AutoRefresh", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not poll without the trigger event", () => {
    const refresh = getRefreshMock();
    render(<AutoRefresh intervalMs={1000} />);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("starts polling after rider-photo-needed event", () => {
    const refresh = getRefreshMock();
    render(<AutoRefresh intervalMs={1000} />);
    dispatchPhotoNeeded();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops after exactly 3 refreshes", () => {
    const refresh = getRefreshMock();
    render(<AutoRefresh intervalMs={1000} />);
    dispatchPhotoNeeded();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("second event does not restart a running poll", () => {
    const refresh = getRefreshMock();
    render(<AutoRefresh intervalMs={1000} />);
    dispatchPhotoNeeded();
    dispatchPhotoNeeded();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("cleans up on unmount", () => {
    const refresh = getRefreshMock();
    const { unmount } = render(<AutoRefresh intervalMs={1000} />);
    dispatchPhotoNeeded();
    act(() => { jest.advanceTimersByTime(1000); });
    unmount();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops listening after unmount", () => {
    const refresh = getRefreshMock();
    const { unmount } = render(<AutoRefresh intervalMs={1000} />);
    unmount();
    dispatchPhotoNeeded();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("respects custom intervalMs", () => {
    const refresh = getRefreshMock();
    render(<AutoRefresh intervalMs={2000} />);
    dispatchPhotoNeeded();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(500); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
