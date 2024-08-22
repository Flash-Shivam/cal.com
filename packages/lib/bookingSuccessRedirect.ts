import type { EventType } from "@prisma/client";
import { useRouter } from "next/navigation";

import type { PaymentPageProps } from "@calcom/ee/payments/pages/payment";
import type { BookingResponse } from "@calcom/features/bookings/types";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { navigateInTopWindow } from "@calcom/lib/navigateInTopWindow";

function getNewSeachParams(args: {
  query: Record<string, string | null | undefined | boolean>;
  searchParams?: URLSearchParams;
}) {
  const { query, searchParams } = args;
  const newSearchParams = new URLSearchParams(searchParams);
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    newSearchParams.append(key, String(value));
  });
  return newSearchParams;
}

type SuccessRedirectBookingType = Pick<
  BookingResponse | PaymentPageProps["booking"],
  "uid" | "title" | "description" | "startTime" | "endTime" | "location"
> & {
  references?: any;
  responses?: any;
};

export const getBookingRedirectExtraParams = (
  booking: SuccessRedirectBookingType,
  forwardBookingParamsSuccessRedirect: boolean
) => {
  type BookingResponseKey = keyof SuccessRedirectBookingType;
  const redirectQueryParamKeys: BookingResponseKey[] = [
    "title",
    "description",
    "startTime",
    "endTime",
    "location",
  ];

  const basicParams = (Object.keys(booking) as BookingResponseKey[])
    .filter((key) => redirectQueryParamKeys.includes(key))
    .reduce((obj, key) => ({ ...obj, [key]: booking[key] }), {});

  if (forwardBookingParamsSuccessRedirect) {
    const serializeResponseValue = (value: any): string => {
      if (Array.isArray(value)) {
        return value.join(",");
      } else if (typeof value === "object" && value !== null) {
        return encodeURIComponent(JSON.stringify(value));
      } else {
        return String(value);
      }
    };

    const responseParams = booking.responses
      ? Object.keys(booking.responses as Record<string, any>).reduce((obj, key) => {
          obj[`responses.${key}`] = serializeResponseValue((booking.responses as Record<string, any>)[key]);
          return obj;
        }, {} as Record<string, any>)
      : {};

    const meetingLink = (booking.references as { meetingUrl?: string }[] | undefined)?.find(
      (ref: { meetingUrl?: string }) => ref.meetingUrl
    )?.meetingUrl;

    if (meetingLink) {
      responseParams["responses.location"] = meetingLink;
    }

    return {
      ...basicParams,
      ...responseParams,
    };
  }

  return {
    ...basicParams,
  };
};

export const useBookingSuccessRedirect = () => {
  const router = useRouter();
  const searchParams = useCompatSearchParams();
  const bookingSuccessRedirect = ({
    successRedirectUrl,
    query,
    booking,
    forwardParamsSuccessRedirect,
    forwardBookingParamsSuccessRedirect,
  }: {
    successRedirectUrl: EventType["successRedirectUrl"];
    forwardParamsSuccessRedirect: EventType["forwardParamsSuccessRedirect"];
    forwardBookingParamsSuccessRedirect: EventType["forwardBookingParamsSuccessRedirect"];
    query: Record<string, string | null | undefined | boolean>;
    booking: SuccessRedirectBookingType;
  }) => {
    if (successRedirectUrl) {
      const url = new URL(successRedirectUrl);
      // Using parent ensures, Embed iframe would redirect outside of the iframe.
      if (!forwardParamsSuccessRedirect) {
        navigateInTopWindow(url.toString());
        return;
      }
      const bookingExtraParams = getBookingRedirectExtraParams(booking, forwardBookingParamsSuccessRedirect);
      const newSearchParams = getNewSeachParams({
        query: {
          ...query,
          ...bookingExtraParams,
        },
        searchParams: searchParams ?? undefined,
      });

      newSearchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });

      navigateInTopWindow(url.toString());
      return;
    }
    const newSearchParams = getNewSeachParams({ query });
    return router.push(`/booking/${booking.uid}?${newSearchParams.toString()}`);
  };

  return bookingSuccessRedirect;
};
