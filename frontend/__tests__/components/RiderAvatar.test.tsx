import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RiderAvatar from "../../components/RiderAvatar";

describe("RiderAvatar", () => {
  it("renders an img when photoUrl is provided", () => {
    render(<RiderAvatar name="Pogacar" photoUrl="https://pcs.com/photo.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://pcs.com/photo.jpg");
    expect(img).toHaveAttribute("alt", "Pogacar");
  });

  it("renders a placeholder div when photoUrl is empty", () => {
    const { container } = render(<RiderAvatar name="Pogacar" photoUrl="" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("dispatches rider-photo-needed on placeholder hover", () => {
    const { container } = render(<RiderAvatar name="Pogacar" photoUrl="" />);
    const listener = jest.fn();
    window.addEventListener("rider-photo-needed", listener);
    fireEvent.mouseEnter(container.querySelector("div")!);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("rider-photo-needed", listener);
  });

  it("does not dispatch rider-photo-needed when photo exists", () => {
    render(<RiderAvatar name="Pogacar" photoUrl="https://pcs.com/photo.jpg" />);
    const listener = jest.fn();
    window.addEventListener("rider-photo-needed", listener);
    fireEvent.mouseEnter(screen.getByRole("img"));
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener("rider-photo-needed", listener);
  });

  it("hides img on error", () => {
    render(<RiderAvatar name="Pogacar" photoUrl="https://pcs.com/photo.jpg" />);
    const img = screen.getByRole("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe("none");
  });

  it("applies size prop to placeholder", () => {
    const { container } = render(<RiderAvatar name="X" photoUrl="" size={44} />);
    const div = container.querySelector("div")!;
    expect(div).toHaveStyle({ width: "44px", height: "44px" });
  });

  it("applies size prop to img", () => {
    render(<RiderAvatar name="X" photoUrl="https://pcs.com/photo.jpg" size={44} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "44");
    expect(img).toHaveAttribute("height", "44");
  });
});
