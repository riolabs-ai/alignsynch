"use client";
import { categories } from "@/data/categories";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { Button } from "../ui/button";
export function CategoriesSlider() {
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Quiz Categories</h2>
        <div className="flex items-center gap-4">
          <Button className="prev-category" variant={"outline"} size={"icon"}>
            <ChevronLeft />
          </Button>
          <Button className="next-category" variant={"outline"} size={"icon"}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <Swiper slidesPerView={"auto"} autoplay={{ delay: 2500 }} navigation={{ nextEl: ".next-category", prevEl: ".prev-category" }} spaceBetween={16} modules={[Navigation, Autoplay]} loop wrapperClass="rounded-xl" className="rounded-xl">
        {categories.map(({ id, image, name, slug, count }) => (
          <SwiperSlide key={id} className="max-w-[330px]">
            <Link href={`/categories/${slug}`} className={`relative overflow-hidden rounded-xl text-white h-[200px] flex justify-between  shadow-sm items-end`}>
              <Image className="size-full object-cover object-center absolute inset-0" src={image} alt="" />
              <div className="absolute top-2 right-2 bg-white/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium">{count}</div>
              <span className="px-3 py-1.5 rounded-full bg-black/60 text-neutral-100 font-semibold backdrop-blur-sm text-sm absolute top-4 left-4 tracking-tight">{name}</span>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
