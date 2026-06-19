import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import RiderTooltip from "../../components/RiderTooltip";
import * as api from "../../lib/api";
import type { Rider, RiderDetails } from "../../lib/api";

// Clear the module-level detailsCache between tests by re-importing fresh each time
jest.mock("../../lib/api", () => ({
  ...jest.requireActual("../../lib/api"),
  apiRiderDetails: jest.fn(),
}));

const mockApiRiderDetails = api.apiRiderDetails as jest.Mock;

function makeRider(overrides: Partial<Rider> = {}): Rider {
  return {
    id: 1,
    name: "Tadej Pogacar",
    team: "UAE Team Emirates",
    nationality: "SI",
    prev_year_points: 11680,
    current_year_points: 2075,
    pcs_url: "rider/tadej-pogacar",
    photo_url: "",
    ...overrides,
  };
}

function makeDetails(overrides: Partial<RiderDetails> = {}): RiderDetails {
  return {
    recent_results: [
      { date: "2026-04-06", rank: 1, race_name: "Paris-Roubaix", race_url: "race/paris-roubaix", uci_points: 500, category: "1.UWT" },
    ],
    upcoming_races: [
      { date: "2026-04-19", race_name: "Liege-Bastogne-Liege", race_url: "race/liege-bastogne-liege" },
    ],
    ...overrides,
  };
}

// Reset the module-level cache by resetting the module between tests
beforeEach(() => {
  jest.resetModules();
  mockApiRiderDetails.mockReset();
});

describe("RiderTooltip", () => {
  it("shows tooltip on hover", () => {
    render(
      <RiderTooltip rider={makeRider()}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseMove(screen.getByText("hover me"), { clientX: 100, clientY: 100 });
    expect(screen.getByText("Tadej Pogacar")).toBeInTheDocument();
    expect(screen.getByText("UAE Team Emirates")).toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", () => {
    render(
      <RiderTooltip rider={makeRider()}>
        <span>hover me</span>
      </RiderTooltip>
    );
    const trigger = screen.getByText("hover me");
    fireEvent.mouseMove(trigger, { clientX: 100, clientY: 100 });
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText("UAE Team Emirates")).toBeNull();
  });

  it("shows cost and score in tooltip", () => {
    render(
      <RiderTooltip rider={makeRider({ id: 100 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseMove(screen.getByText("hover me"), { clientX: 100, clientY: 100 });
    // toLocaleString output varies by environment; match the numeric value with a regex
    expect(screen.getByText(/11.?680/)).toBeInTheDocument();
    expect(screen.getByText(/2.?075/)).toBeInTheDocument();
  });

  it("fetches details after 400ms delay", async () => {
    jest.useFakeTimers();
    mockApiRiderDetails.mockResolvedValueOnce(makeDetails());
    render(
      <RiderTooltip rider={makeRider({ id: 10 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseEnter(screen.getByText("hover me"));
    expect(mockApiRiderDetails).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(mockApiRiderDetails).toHaveBeenCalledWith(10);
    jest.useRealTimers();
  });

  it("does not fetch before delay elapses", () => {
    jest.useFakeTimers();
    render(
      <RiderTooltip rider={makeRider({ id: 20 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseEnter(screen.getByText("hover me"));
    act(() => { jest.advanceTimersByTime(300); });
    expect(mockApiRiderDetails).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("cancels fetch when mouse leaves before delay", () => {
    jest.useFakeTimers();
    render(
      <RiderTooltip rider={makeRider({ id: 30 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    const trigger = screen.getByText("hover me");
    fireEvent.mouseEnter(trigger);
    act(() => { jest.advanceTimersByTime(200); });
    fireEvent.mouseLeave(trigger);
    act(() => { jest.advanceTimersByTime(400); });
    expect(mockApiRiderDetails).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("shows recent results after fetch resolves", async () => {
    jest.useFakeTimers();
    mockApiRiderDetails.mockResolvedValueOnce(makeDetails());
    render(
      <RiderTooltip rider={makeRider({ id: 40 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseMove(screen.getByText("hover me"), { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(screen.getByText("hover me"));
    await act(async () => { jest.advanceTimersByTime(400); });
    await waitFor(() => expect(screen.getByText("Paris-Roubaix")).toBeInTheDocument());
    jest.useRealTimers();
  });

  it("does not crash on fetch error", async () => {
    jest.useFakeTimers();
    mockApiRiderDetails.mockRejectedValueOnce(new Error("network error"));
    render(
      <RiderTooltip rider={makeRider({ id: 50 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseMove(screen.getByText("hover me"), { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(screen.getByText("hover me"));
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(screen.getByText("Tadej Pogacar")).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("formats rank labels correctly", async () => {
    jest.useFakeTimers();
    const details = makeDetails({
      recent_results: [
        { date: "2026-04-01", rank: 1, race_name: "Race A", race_url: "race/a", uci_points: 100, category: "1.UWT" },
        { date: "2026-04-02", rank: 2, race_name: "Race B", race_url: "race/b", uci_points: 80, category: "1.UWT" },
        { date: "2026-04-03", rank: 4, race_name: "Race C", race_url: "race/c", uci_points: 60, category: "1.UWT" },
      ],
      upcoming_races: [],
    });
    mockApiRiderDetails.mockResolvedValueOnce(details);
    render(
      <RiderTooltip rider={makeRider({ id: 60 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseMove(screen.getByText("hover me"), { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(screen.getByText("hover me"));
    await act(async () => { jest.advanceTimersByTime(400); });
    await waitFor(() => screen.getByText("1st"));
    expect(screen.getByText("2nd")).toBeInTheDocument();
    expect(screen.getByText("4th")).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("formats dates as DD.MM", async () => {
    jest.useFakeTimers();
    mockApiRiderDetails.mockResolvedValueOnce(makeDetails({
      recent_results: [
        { date: "2026-04-15", rank: 1, race_name: "Race X", race_url: "race/x", uci_points: 100, category: "1.UWT" },
      ],
    }));
    render(
      <RiderTooltip rider={makeRider({ id: 70 })}>
        <span>hover me</span>
      </RiderTooltip>
    );
    fireEvent.mouseMove(screen.getByText("hover me"), { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(screen.getByText("hover me"));
    await act(async () => { jest.advanceTimersByTime(400); });
    await waitFor(() => screen.getByText("15.04"));
    jest.useRealTimers();
  });
});
